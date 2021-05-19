---
layout: post
title: User-Space Probes
description: Uprobes 介绍
category: code
tags: [linux, uprobes]
---
由于最近在研究 ebpf ，对于 ebpf 和 trace 相关的实现原理希望有些了解。
这篇文章介绍 uprobes 的相关概念和实现原理。
这篇文章翻译自 `User-Space Probes (Uprobes)`
作者 `Jim Keniston` 原文链接在文末。

## Concepts: Uprobes, Return Probes
Uprobes 能够动态的非破坏性的插入任务程序，收集应用程序的 debugging 和 性能信息。
我们可以在代码任何位置，在命中断点时，kernel 对应的处理函数将会被调用。

当前存在两个类型的 user-space 探针：

- uprobes 
- uretprobes(也就是返回类型探针)

一个探针可以插入指令在一个应用程序的虚拟地址空间中。
返回类型探针触发时机是在用户指定的函数返回时。

注册函数 `register_uprobe()` 能够注册探针到进程中。
当探针被插入，当探针命中时，对应的处理函数将被调用。

通常，uprobes 是一组 kernel 模块。在一个最简单的案例中，
模块的 init 函数安装一个或者多个探针，exit 函数注销探针的注册。
当然，探针也可以注册和注销在其他事件中，例如：

- 探针可以注册和注销其他探针
- 我们可以建立 utrace 回调中注册和注销探针，当 进程 forks 了进程，clones 了线程，
  execs 进入一个系统调用，收到一个 signal。

### How Does a Uprobe Work?
当一个探针被注册，uprobes 将拷贝一个被探针指令的副本，挂起被探针的进程，
使用断点指令(在 i386 和 x86_64 是 int3)替换掉这个被探针的第一个指令，
随后运行被挂起的进程。(当插入断点时，uprobes 使用类似 ptrace 的 copy-on-write 机制，
这样使得这个断点只会影响当前这个进程，其他进程正常运行，即使探针在共享库上)

当 CPU 命中这个断点探针时，trap 将发生，CPU 将保存 user-mode 下的寄存器，
并且生成一个 SIGTRAP 信号。uprobes 拦截到 SIGTRAP 信号，并且找到相关的 uprobe。
随后执行这个 uprobe 关联的处理函数，传递 uprobe 结构体的地址和保存的寄存器给这个处理函数。
这个处理函数可能回阻塞，但是我们仍然只会挂在被探针的线程。

随即，uprobes 将在上面拷贝的副本指令下单步执行，唤醒挂起的进程在探针点出继续执行。
(实际上单步执行原始指令会更简单，但之后，Uprobes 必须移除断点指令。
这在多线程应用程序中会引起问题。比如，当另一个线程执行过探测点的时会打开一个时间窗口。)

存储单步执行指令的区域在每一个进程的 SSOL 区域，这个是一个被 uprobes 创建的很小的虚拟地址空间。
### The Role of Utrace
当一个探针注册到之前没有被探针到进程中时，
uprobes 将使用 utrace 为进程中到每个线程创建一个跟踪引擎。
uprobes 使用 utrace 的`静默`机制在插入和移除断点之前停止所有的线程。
utrace 也会在断点，单步调试陷入和其他有趣的事情上通知 uprobes，
例如：fork，clone，exec，exit。

### How Does a Return Probe Work?
当调用 register_uretprobe() 后，uprobes 将在函数到入口出建立一个探针。
当函数被调用，这个探针将被命中，uprobes 保存这个函数当返回地址当一个副本，
使用 trampoline 地址替换调这个返回地址，这段代码中包含了一个断点指令。

当探针函数执行返回指令时，断点命中，控制将转移到 trampoline 上。
探针的 trampoline 处理函数将调用 uretprobe 指定当用户处理函数，
设置这个 PC 指针到保存的返回地址上，当 trap 返回这是执行将恢复。

trampoline 被存储在 SSOL 区域。

### Multithreaded Applications
uprobes 支持在多线程应用程序上使用探针。
uprobes 不会限制被探针进程的线程树。
所有进程中的线程都有同样的 `text page`，所有每一个探针将影响进程中的所有线程。
当然每一个线程命中 probepoint 是单独的。多个线程可能同是运行同一个处理函数。
如果我们想部分线程或者特定的一组线程运行处理函数，
我们只能通过检测当前的线程 ID 来决定是不是命中 probepoint。

当一个进程 clones 一个新的线程，这个线程将自动的拥有这个进程的所有探针。

当我们注册/注销一个探针时，断点不会被插入和删除，一直到 utrace 停止进程中的所有线程。
注册/注销 函数在断点已经被 插入/删除 后返回。

### Registering Probes within Probe Handlers

## Architectures Supported
uprobes 和 uretprobes 当前支持的架构有：

- i386
- x86_64 (AMD-64, EM64T)
- ppc64
- ia64
- s390x

## Interoperation with Kprobes
Uprobes 打算与 Kprobes 进行有效的相互操作。
例如，检测模块可以同时调用 Kprobes API 和 Uprobes API。

uprobe 或 uretprobe 回调函数可以注册或注销 kprobes、jprobes、kretprobes，以及 uprobes 和 uretprobes。
另外，kprobe、jprobe、kretprobe 回调函数一定不能休眠，不然会无法注册或注销这些探针。

注意，`u[ret]probe` 类型的探针性能开支会比 `k[ret]probe` 类型高出好几倍。

## Interoperation with Utrace
在上面的介绍中，我们知道 uprobes 是 utrace 的一个 client。
对于每一个可探针的线程，Uprobes 会创建一个 Utrace 引擎，
随后为以下时间注册回调：clone/fork，exec，exit，"core-dump" 信号(包括断点陷阱)。
当进程第一触发探针时，Uprobes 创建这个引擎，或者 Uprobes 通知线程创建，这两个都是可以的。

## Probe Overhead
2007 中的一个通常 CPU，一个探针大概会有 3 微秒的延迟。
特别的，在同一个探针点，触发一个简单的打印时间基准测试中。
一秒的 qps 是 300000 - 350000 之间，不同的架构有所不同。
一个返回类型探针通常会比 uprobe 探针多大概 50% 。
当一个函数已经有一个返回类型探针，这是添加一个 uprobe 探针将不会有额外的新能损失。

这里不同架构下的样列：

- u = uprobe 
- r = return probe
- ur = uprobe + return probe

```text
i386: Intel Pentium M, 1495 MHz, 2957.31 bogomips
u = 2.9 usec; r = 4.7 usec; ur = 4.7 usec

x86_64: AMD Opteron 246, 1994 MHz, 3971.48 bogomips
// TODO

ppc64: POWER5 (gr), 1656 MHz (SMT disabled, 1 virtual CPU per physical CPU)
// TODO
```


## 参考

- [Uprobes](https://sourceware.org/git/?p=systemtap.git;a=blob_plain;f=runtime/uprobes/uprobes.txt;hb=a2b182f549cf64427a474803f3c02286b8c1b5e1)
- [译｜2008｜User-Space Probes (Uprobes)](https://jayce.github.io/public/posts/trace/user-space-probes/)

[-10]:    http://hushi55.github.io/  "-10"
