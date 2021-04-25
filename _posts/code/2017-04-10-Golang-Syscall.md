---
layout: post
title: Golang 源码分析 - syscall
description: Goroutine 源码分析 - syscall
category: code
tags: [linux, Golang]
---

## 为什么要接管 syscall

回答第一篇文章的哪个问题

- 当 goroutine 系统调用时，这个系统调用可能由于阻塞，导致 kernel 将这个线程挂起来了，要是这个系统阻塞的时间比较长，就有可能导致调度永远无法往走了，等待调度的 goroutine 就失去了运行了的机会了。

要解决这个问题，可以有两个解决方案：

- 单线程：我们只有一个解决办法，就是使用非阻塞的IO系统调用，并让出CPU，然后在schedule()里统一进行轮询，有数据时切换回该fd对应的任务；效率略低的做法是不进行统一轮询，让各个任务在轮到自己执行时再次用非阻塞方式进行IO，直到有数据可用。
- 多线程：我们可以封装系统调用的接口，当某个任务进入系统调用时，我们就把当前线程留给它(暂时)独享，并开启新的线程来处理其他任务。

golang 采用的就是第二种解决方案，将当前这个线程独享给 goroutine，开启单独的线程来出调度。为了达到这个目的，那么 golang 必然要重写所有的 syscall，在会阻塞的系统调用之前要剥离 `P` 对象，系统调用完成之后试图绑定 `P` 对象和介入调度。


## 如何接管的

我们通过 `file.Read()` 这个系统调用来分析。

```go
/usr/local/go/src/os/file.go:97

// Read reads up to len(b) bytes from the File.
// It returns the number of bytes read and an error, if any.
// EOF is signaled by a zero count with err set to io.EOF.
func (f *File) Read(b []byte) (n int, err error) {
	if f == nil {
		return 0, ErrInvalid
	}
	n, e := f.read(b)
	if n == 0 && len(b) > 0 && e == nil {
		return 0, io.EOF
	}
	if e != nil {
		err = &PathError{"read", f.name, e}
	}
	return n, err
}
```

在 f.read(b) 最终会调用到

```go
/usr/local/go/src/syscall/zsyscall_linux_amd64.go:776

func read(fd int, p []byte) (n int, err error) {
	var _p0 unsafe.Pointer
	if len(p) > 0 {
		_p0 = unsafe.Pointer(&p[0])
	} else {
		_p0 = unsafe.Pointer(&_zero)
	}
	r0, _, e1 := Syscall(SYS_READ, uintptr(fd), uintptr(_p0), uintptr(len(p)))
	n = int(r0)
	if e1 != 0 {
		err = errnoErr(e1)
	}
	return
}
```

```cgo
/usr/local/go/src/syscall/asm_linux_amd64.s

// func Syscall(trap int64, a1, a2, a3 int64) (r1, r2, err int64);
// Trap # in AX, args in DI SI DX R10 R8 R9, return in AX DX
// Note that this differs from "standard" ABI convention, which
// would pass 4th arg in CX, not R10.

TEXT	·Syscall(SB),NOSPLIT,$0-56
	CALL	runtime·entersyscall(SB)
	MOVQ	a1+8(FP), DI
	MOVQ	a2+16(FP), SI
	MOVQ	a3+24(FP), DX
	MOVQ	$0, R10
	MOVQ	$0, R8
	MOVQ	$0, R9
	MOVQ	trap+0(FP), AX	// syscall entry
	SYSCALL
	CMPQ	AX, $0xfffffffffffff001
	JLS	ok
	MOVQ	$-1, r1+32(FP)
	MOVQ	$0, r2+40(FP)
	NEGQ	AX
	MOVQ	AX, err+48(FP)
	CALL	runtime·exitsyscall(SB)
	RET
ok:
	MOVQ	AX, r1+32(FP)
	MOVQ	DX, r2+40(FP)
	MOVQ	$0, err+48(FP)
	CALL	runtime·exitsyscall(SB)
	RET
```

可以清楚看到最中的系统调用会在：

- 调用之前：`runtime·entersyscall(SB)` 
- 调用之后：`runtime·exitsyscall(SB)`

我们可以着重分析下，这两函数的主要干了啥事

```go
/usr/local/go/src/runtime/proc.go:2310

func reentersyscall(pc, sp uintptr) {
	_g_ := getg()

	// Disable preemption because during this function g is in Gsyscall status,
	// but can have inconsistent g->sched, do not let GC observe it.
	_g_.m.locks++

	// Entersyscall must not call any function that might split/grow the stack.
	// (See details in comment above.)
	// Catch calls that might, by replacing the stack guard with something that
	// will trip any stack check and leaving a flag to tell newstack to die.
	_g_.stackguard0 = stackPreempt
	_g_.throwsplit = true

	// Leave SP around for GC and traceback.
	save(pc, sp)
	_g_.syscallsp = sp
	_g_.syscallpc = pc
	casgstatus(_g_, _Grunning, _Gsyscall)
	if _g_.syscallsp < _g_.stack.lo || _g_.stack.hi < _g_.syscallsp {
		systemstack(func() {
			print("entersyscall inconsistent ", hex(_g_.syscallsp), " [", hex(_g_.stack.lo), ",", hex(_g_.stack.hi), "]\n")
			throw("entersyscall")
		})
	}

	if trace.enabled {
		systemstack(traceGoSysCall)
		// systemstack itself clobbers g.sched.{pc,sp} and we might
		// need them later when the G is genuinely blocked in a
		// syscall
		save(pc, sp)
	}

	if atomic.Load(&sched.sysmonwait) != 0 { // TODO: fast atomic
		systemstack(entersyscall_sysmon)
		save(pc, sp)
	}

	if _g_.m.p.ptr().runSafePointFn != 0 {
		// runSafePointFn may stack split if run on this stack
		systemstack(runSafePointFn)
		save(pc, sp)
	}

	_g_.m.syscalltick = _g_.m.p.ptr().syscalltick
	_g_.sysblocktraced = true
	_g_.m.mcache = nil
	_g_.m.p.ptr().m = 0
	atomic.Store(&_g_.m.p.ptr().status, _Psyscall)
	if sched.gcwaiting != 0 {
		systemstack(entersyscall_gcwait)
		save(pc, sp)
	}

	// Goroutines must not split stacks in Gsyscall status (it would corrupt g->sched).
	// We set _StackGuard to StackPreempt so that first split stack check calls morestack.
	// Morestack detects this case and throws.
	_g_.stackguard0 = stackPreempt
	_g_.m.locks--
}
```

```go
/usr/local/go/src/runtime/proc.go:2461

// The goroutine g exited its system call.
// Arrange for it to run on a cpu again.
// This is called only from the go syscall library, not
// from the low-level system calls used by the runtime.
//go:nosplit
func exitsyscall(dummy int32) {
	_g_ := getg()

	_g_.m.locks++ // see comment in entersyscall
	if getcallersp(unsafe.Pointer(&dummy)) > _g_.syscallsp {
		// throw calls print which may try to grow the stack,
		// but throwsplit == true so the stack can not be grown;
		// use systemstack to avoid that possible problem.
		systemstack(func() {
			throw("exitsyscall: syscall frame is no longer valid")
		})
	}

	_g_.waitsince = 0
	oldp := _g_.m.p.ptr()
	if exitsyscallfast() {
		if _g_.m.mcache == nil {
			throw("lost mcache")
		}
		if trace.enabled {
			if oldp != _g_.m.p.ptr() || _g_.m.syscalltick != _g_.m.p.ptr().syscalltick {
				systemstack(traceGoStart)
			}
		}
		// There's a cpu for us, so we can run.
		_g_.m.p.ptr().syscalltick++
		// We need to cas the status and scan before resuming...
		casgstatus(_g_, _Gsyscall, _Grunning)

		// Garbage collector isn't running (since we are),
		// so okay to clear syscallsp.
		_g_.syscallsp = 0
		_g_.m.locks--
		if _g_.preempt {
			// restore the preemption request in case we've cleared it in newstack
			_g_.stackguard0 = stackPreempt
		} else {
			// otherwise restore the real _StackGuard, we've spoiled it in entersyscall/entersyscallblock
			_g_.stackguard0 = _g_.stack.lo + _StackGuard
		}
		_g_.throwsplit = false
		return
	}

	_g_.sysexitticks = 0
	if trace.enabled {
		// Wait till traceGoSysBlock event is emitted.
		// This ensures consistency of the trace (the goroutine is started after it is blocked).
		for oldp != nil && oldp.syscalltick == _g_.m.syscalltick {
			osyield()
		}
		// We can't trace syscall exit right now because we don't have a P.
		// Tracing code can invoke write barriers that cannot run without a P.
		// So instead we remember the syscall exit time and emit the event
		// in execute when we have a P.
		_g_.sysexitticks = cputicks()
	}

	_g_.m.locks--

	// Call the scheduler.
	mcall(exitsyscall0)

	if _g_.m.mcache == nil {
		throw("lost mcache")
	}

	// Scheduler returned, so we're allowed to run now.
	// Delete the syscallsp information that we left for
	// the garbage collector during the system call.
	// Must wait until now because until gosched returns
	// we don't know for sure that the garbage collector
	// is not running.
	_g_.syscallsp = 0
	_g_.m.p.ptr().syscalltick++
	_g_.throwsplit = false
}

```

```go
func gosave(buf *gobuf)
```

## 经典案例分析

[一个 Go 程序系统线程暴涨的问题](https://zhuanlan.zhihu.com/p/22474724)

在这个案例中，很清楚的看到了阻塞的 syscall 会造成什么影响


## 参考


[-10]:   	 http://hushi55.github.io/  "-10"