---
layout: post
title: linux ftrace
description: linux ftrace 工具介绍和使用
category: code
tags: [linux, kernel, ftrace]
---
## linux ftrace 介绍
ftrace 的作用是帮助开发人员了解 Linux 内核的运行时行为，以便进行故障调试或性能分析。
最早 ftrace 是一个 function tracer，仅能够记录内核的函数调用流程。
如今 ftrace 已经成为一个 framework，采用 plugin 的方式支持开发人员添加更多种类的 trace 功能。

- Function tracer 和 Function graph tracer: 跟踪函数调用。
- Schedule switch tracer: 跟踪进程调度情况。
- Wakeup tracer：跟踪进程的调度延迟，即高优先级进程从进入 ready 状态到获得 CPU 的延迟时间。该 tracer 只针对实时进程。
- Irqsoff tracer：当中断被禁止时，系统无法相应外部事件，比如键盘和鼠标，时钟也无法产生 tick 中断。这意味着系统响应延迟，irqsoff 这个 tracer 能够跟踪并记录内核中哪些函数禁止了中断，对于其中中断禁止时间最长的，irqsoff 将在 log 文件的第一行标示出来，从而使开发人员可以迅速定位造成响应延迟的罪魁祸首。
- Preemptoff tracer：和前一个 tracer 类似，preemptoff tracer 跟踪并记录禁止内核抢占的函数，并清晰地显示出禁止抢占时间最长的内核函数。
- Preemptirqsoff tracer: 同上，跟踪和记录禁止中断或者禁止抢占的内核函数，以及禁止时间最长的函数。
- Branch tracer: 跟踪内核程序中的 likely/unlikely 分支预测命中率情况。 Branch tracer 能够记录这些分支语句有多少次预测成功。从而为优化程序提供线索。
- Hardware branch tracer：利用处理器的分支跟踪能力，实现硬件级别的指令跳转记录。在 x86 上，主要利用了 BTS 这个特性。
- Initcall tracer：记录系统在 boot 阶段所调用的 init call 。
- Mmiotrace tracer：记录 memory map IO 的相关信息。
- Power tracer：记录系统电源管理相关的信息。
- Sysprof tracer：缺省情况下，sysprof tracer 每隔 1 msec 对内核进行一次采样，记录函数调用和堆栈信息。
- Kernel memory tracer: 内存 tracer 主要用来跟踪 slab allocator 的分配情况。包括 kfree，kmem_cache_alloc 等 API 的调用情况，用户程序可以根据 tracer 收集到的信息分析内部碎片情况，找出内存分配最频繁的代码片断，等等。
- Workqueue statistical tracer：这是一个 statistic tracer，统计系统中所有的 workqueue 的工作情况，比如有多少个 work 被插入 workqueue，多少个已经被执行等。开发人员可以以此来决定具体的 workqueue 实现，比如是使用 single threaded workqueue 还是 per cpu workqueue.
- Event tracer: 跟踪系统事件，比如 timer，系统调用，中断等。

我们可以通过以下命令来查看本机支持的 tracer：

<pre class="nowordwrap">
[root@docker221 tracing]# cat /sys/kernel/debug/tracing/available_tracers 
blk function_graph wakeup_rt wakeup function nop
[root@docker221 tracing]# 
</pre>

## linux ftrace 架构和设计
ftrace 的整体架构如下图：

![](/images/linux-trace/ftrace-architecture.jpg)

Ftrace 有两大组成部分，一是 framework，另外就是一系列的 tracer 。每个 tracer 完成不同的功能，
它们统一由 framework 管理。 ftrace 的 trace 信息保存在 ring buffer 中，由 framework 负责管理。 
Framework 利用 debugfs 系统在 /debugfs 下建立 tracing 目录，并提供了一系列的控制文件。

### ftrace 的实现
Ftrace 采用 GCC 的 profile 特性在所有内核函数的开始部分加入一段 stub 代码，ftrace 重载这段代码来实现 trace 功能。

gcc 的 -pg 选项将在每个函数入口处加入对 mcount 的调用代码。比如下面的 C 代码。

<pre class="nowordwrap">
//test.c 
void foo(void) 
{ 
  printf(" foo "); 
}
</pre>

用 gcc 编译：

<pre class="nowordwrap">
gcc – S test.c
</pre>

反汇编如下：

<pre class="nowordwrap">
_foo: 
        pushl   %ebp 
        movl    %esp, %ebp 
        subl    $8, %esp 
        movl    $LC0, (%esp) 
        call    _printf 
        leave 
        ret
</pre>

再加入 -gp 选项编译：

<pre class="nowordwrap">
gcc – pg – S test.c
</pre>

得到的汇编如下：

<pre class="nowordwrap">
_foo: 
        pushl   %ebp 
        movl    %esp, %ebp 
        subl    $8, %esp 
 LP3: 
        movl    $LP3,%edx 
        call    _mcount 
        movl    $LC0, (%esp) 
        call    _printf 
        leave 
        ret
</pre>

增加 pg 选项后，gcc 在函数 foo 的入口处加入了对 mcount 的调用：call _mcount 。原本 mcount 由 libc 实现，
但是我们知道内核不会连接 libc 库，因此 ftrace 编写了自己的 mcount stub 函数，并借此实现 trace 功能。

在每个内核函数入口加入 trace 代码，必然会影响内核的性能，为了减小对内核性能的影响，ftrace 支持动态 trace 功能。

当 CONFIG_DYNAMIC_FTRACE 被选中后，内核编译时会调用一个 perl 脚本：recordmcount.pl 
将每个函数的地址写入一个特殊的段：__mcount_loc

在内核初始化的初期，ftrace 查询 __mcount_loc 段，得到每个函数的入口地址，并将 mcount 替换为 nop 指令。
这样在默认情况下，ftrace 不会对内核性能产生影响。

当用户打开 ftrace 功能时，ftrace 将这些 nop 指令动态替换为 ftrace_caller，该函数将调用用户注册的 trace 函数。

## linux ftrace 使用

## linux ftrace 案例


## 参考

- https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace/

[-10]:    http://hushi55.github.io/  "-10"
