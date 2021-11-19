---
layout: post
title: Golang 源码分析 - goroutine
description: Goroutine 源码分析 - goroutine
category: code
tags: [linux, Golang]
---

由于 gorotine 是协程，那么当单个 goroutine 运行结束后，调度器是如何调度下一个 goroutine 的呢？
由于 golang 是运行在用户态的，那么如果当前这个 goroutine 不主动调用 schedule()，
那么调度器就没有机会调度下一个 goroutine 了。
这一节我们就来看看单个 goroutine 结束后是如何到调度的。即如何主动调用 schedule() 的

```go
/usr/local/go/src/runtime/proc.go:2770

...

newg.sched.sp = sp
newg.stktopsp = sp
newg.sched.pc = funcPC(goexit) + sys.PCQuantum // +PCQuantum so that previous instruction is in same function
newg.sched.g = guintptr(unsafe.Pointer(newg))
gostartcallfn(&newg.sched, fn)

...
	
```

在上一节中咱们讲解了 `go` 关键字是如何产生一个 goroutine 的，`go` 关键字知识编译器的语法糖，
最终会通过编译器和连接器调用 `newproc` ，而后调用 `newproc1` 方法，这个文件 2770 行，
`newg.sched.pc` 被赋值成了 `funcPC(goexit) + sys.PCQuantum`。


随后调用了 `gostartcallfn` 在这个函数中会调用到 `gostartcall` 我们来看看这个函数到

```go
// adjust Gobuf as it if executed a call to fn with context ctxt
// and then did an immediate gosave.
func gostartcall(buf *gobuf, fn, ctxt unsafe.Pointer) {
  sp := buf.sp
  if sys.RegSize > sys.PtrSize {
    sp -= sys.PtrSize
    *(*uintptr)(unsafe.Pointer(sp)) = 0
  }
  sp -= sys.PtrSize
  *(*uintptr)(unsafe.Pointer(sp)) = buf.pc
  buf.sp = sp
  buf.pc = uintptr(fn)
  buf.ctxt = ctxt
}
```

咱们对照下面的内存布局来看看

![](/images/blog/golang/scheduled/new_goroutine.png)

在调用`gostartcall`之前，`buf.pc` 的值是`goexit`，然后将`buf.sp`向低地址移动一个指针大小的位置，
将`buf.pc` 的 值赋给该地址，也就是说 `gostartcall` 就是将 `goexit` 的地址压入了函数调用本来是 `PC` 的内存位置，
这样就会导致当 goroutine 运行结束后 `return` 关键字将调用 `goexit`，
从这里我们也可以推断当调度到执行 goroutine 到函数时，一定不会使用  `call` 指令，
而只能使用 `jmp` 指令，这样才能最后执行 `goexit`，应为当前的内存布局已经是符合函数的调用了。

![](/images/blog/golang/scheduled/goroutine_goexit.png)

## systemcall，mcall 的作用

### 为什么要有 systemcall，mcall
从前面的分析知道，`m` 对象上有两个 `g` 对象，其中一个为 `g` 另外一个 `g0`。其中 `g0` 对象的栈作为了 `m` 对象的底层操作系统的线程执行栈


```go
/usr/local/go/src/runtime/proc.go:1572

...

newosproc(mp, unsafe.Pointer(mp.g0.stack.hi))

...

```

```cgo
/usr/local/go/src/runtime/os_linux.go:152

...

rtsigprocmask(_SIG_SETMASK, &sigset_all, &oset, int32(unsafe.Sizeof(oset)))
ret := clone(cloneFlags, stk, unsafe.Pointer(mp), unsafe.Pointer(mp.g0), unsafe.Pointer(funcPC(mstart)))
rtsigprocmask(_SIG_SETMASK, &oset, nil, int32(unsafe.Sizeof(oset)))

...

```

其中

```go
/usr/local/go/src/runtime/os_linux.go:128

cloneFlags = _CLONE_VM | /* share memory */
		_CLONE_FS | /* share cwd, etc */
		_CLONE_FILES | /* share fd table */
		_CLONE_SIGHAND | /* share sig handler table */
		_CLONE_THREAD /* revisit - okay for now */
```

这样可以保证 `m` 对象在系统线程运行时使用的是 `g0` 栈，当运行 goroutine 时使用的 `g` 栈，
这样可以保证管理 goroutine 时不会和 goroutine 的函数栈帧混在一起，
因为这样可以保证不用在系统状态和 goroutine 状态各自是干净的


### systemcall mcall 解释

- systemcall: 确保函数调用在系统栈上执行，执行完成后回切换回原先的栈。
- mcall: 只能从`g` 栈切换到 `g0` 栈上执行。而且 fn 函数一般是不返回的，这里的所谓不返回一般是一个死循环。如最终调用到 schedule() 函数。 

mcall 所用调用的位置如下图：

![](/images/blog/golang/scheduled/mcall_caller.png)

 - `recovery`
 - `gosched_m`
 - `park_m`
 - `goexit0`
 - `exitsyscall0` 
    
这些函数最终都是会调用到 schedule() 函数，表明这些点就是 golang 介入调度的点。


## Goroutine 调度时机

- 显式调用 schudel()
    - mutex, semaphore
    - channel
- 隐式调用 schudel()
     - goexit
     - 系统调用，阻塞
     - sysmon 抢占调度
     - 网络相关

## Goroutine 完整的调度流程

### 内存布局

### 函数调用过程

## 参考


[-10]:   	 http://hushi55.github.io/  "-10"