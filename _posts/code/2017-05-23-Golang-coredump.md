---
layout: post
title: Golang 源码分析 - coredump
description: Goroutine coredump
category: code
tags: [linux, Golang]
---


<pre class="nowordwrap">

/usr/local/go/src/runtime/runtime1.go:387

...

setTraceback(gogetenv("GOTRACEBACK"))

...


//go:linkname setTraceback runtime/debug.SetTraceback
func setTraceback(level string) {
	var t uint32
	switch level {
	case "none":
		t = 0
	case "single", "":
		t = 1 << tracebackShift
	case "all":
		t = 1<<tracebackShift | tracebackAll
	case "system":
		t = 2<<tracebackShift | tracebackAll
	case "crash":
		t = 2<<tracebackShift | tracebackAll | tracebackCrash
	default:
		t = uint32(atoi(level))<<tracebackShift | tracebackAll
	}
	// when C owns the process, simply exit'ing the process on fatal errors
	// and panics is surprising. Be louder and abort instead.
	if islibrary || isarchive {
		t |= tracebackCrash
	}

	t |= traceback_env

	atomic.Store(&traceback_cache, t)
}
</pre>

<pre class="nowordwrap">
// gotraceback returns the current traceback settings.
//
// If level is 0, suppress all tracebacks.
// If level is 1, show tracebacks, but exclude runtime frames.
// If level is 2, show tracebacks including runtime frames.
// If all is set, print all goroutine stacks. Otherwise, print just the current goroutine.
// If crash is set, crash (core dump, etc) after tracebacking.
//
//go:nosplit
func gotraceback() (level int32, all, crash bool) {
	_g_ := getg()
	all = _g_.m.throwing > 0
	if _g_.m.traceback != 0 {
		level = int32(_g_.m.traceback)
		return
	}
	t := atomic.Load(&traceback_cache)
	crash = t&tracebackCrash != 0
	all = all || t&tracebackAll != 0
	level = int32(t >> tracebackShift)
	return
}
</pre>

- 增加环境变量 GOTRACEBACK=crash
- 修改 core 文件保存的路径
    - 默认生成的 core 文件保存在可执行文件所在的目录下，文件名就为 core。
    - 通过修改 /proc/sys/kernel/core_uses_pid 文件可以让生成 core 文件名是否自动加上 pid 号。
    - 例如 echo 1 > /proc/sys/kernel/core_uses_pid ，生成的 core 文件名将会变成 core.pid，其中 pid 表示该进程的 PID。
    - 还可以通过修改 /proc/sys/kernel/core_pattern 来控制生成 core 文件保存的位置以及文件名格式。例如可以用 echo "/tmp/corefile-%e-%p-%t" > /proc/sys/kernel/core_pattern 设置生成的 core 文件保存在 “/tmp/corefile” 目录下，文件名格式为 “core-命令名-pid-时间戳”。[这里](http://man7.org/linux/man-pages/man5/core.5.html)有更多详细的说明！


## 参考

- [http://www.cnblogs.com/hazir/p/linxu_core_dump.html](http://www.cnblogs.com/hazir/p/linxu_core_dump.html)


[-10]:   	 http://hushi55.github.io/  "-10"