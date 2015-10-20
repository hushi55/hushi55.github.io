---
layout: post
title: systemtap
description: systemtap 介绍
category: code
tags: [linux, kernel, trace, systemtap]
---
## systemtap 介绍
systemtap 可以用于开发者和系统管理员通过编写简单的脚本就可以调试复杂的性能和功能问题。

### 原理
systemtap 的执行过程：

![](http://myaut.github.io/dtrace-stap-book/images/stapprocess.png)

从上图我们可以看到 systemtap 是将脚本编译成 kernel module 来实现 trace 的。linux 的大部分分发版本的 symbol tables 是删除的。
为了提高 systemtap 的 trace 能力，所以我们要自己提供 debug 相关的信息，基于 RPM 的分发版本使用 -debuginfo 的 rpm 包，如 RHEL 需要
kernel-devel, kernel-debuginfo and kernel-debuginfo-common rpm 包，新版本的 systemtap 现在提供了 stap-prep 工具
来自动安装这些依赖。

## systemtap langref

### probe 类型

- begin：开始一个 systemtap seesion 时。
- end：一个 systemtap seesion 结束时。
- kernel.function("sys_open")：进入 sys_open 函数调用时。
- syscall.close.return：close 系统调用返回时。
- module("ext3").statement(0xdeadbeef)：ext3 的一个特定地址。
- timer.ms(200)：每 200 毫秒。
- timer.profile： 每个 cpu 定时触发。
- perf.hw.cache_misses： cache misses 发生时。
- procfs("status").read：进程发生 read 操作时。
- process("a.out").statement("*@main.c:200")：a.out 程序的 200 行。

### 内置函数

- tid()：当前线程 id
- pid()：当前线程的进程 id 
- uid()：当前用户 id 
- execname()：当前进程的名称 
- cpu()：当前 cpu 的编号 
- gettimeofday_s()：系统纪元以来的秒数 
- get_cycles()：cpu 的计数器快照
- pp()：当前探针的描述字符串
- ppfunc()：当前探针的函数名称，如果有 
- $$vars：打印当前的所有本地变量 
- print_backtrace()：打印内核堆栈 
- print_ubacktrace()：打印用户堆栈

### 内置数据结构

Arrays：
数组类型其实一种 hash table，而且是一种支持多个 key 的 hash table，有点像 awk 中的 array，需要注意的是 hash table 的定义必须在
定义为全局变量，并且在开始运行程序前就要确定这个 table 的大小，默认通过 MAXMAPENTRIES 参数来决定，默认是 2048。arrays 的一些操作：

- if ([4,"hello"] in foo) { } ：测试成员是否存在
- delete times[tid()] ：删除单个元素
- delete times ：删除所有元素
- foreach (x = [a,b] in foo) { fuss_with(x) } ：简单的任意顺序迭代
- foreach ([a,b] in foo+ limit 5) { } ：从值的递增迭代 5 次
- foreach ([a-,b] in foo) { } ：从第一个 key 的递减迭代

Aggregates：
聚合统计数据结构，使用 <<< 操作符向 aggregates 变量中添加数据，数据只能是数字类型。它只能定义为全局类型的，但是 array 的每个元素可以是一个
aggregates 类型的变量。获取它的值只能通过 @min, @max, @count, @avg, @sum, @hist_log, @hist_linear 来读取值。 


## stap tips

- -l 查找特定探针 # stap -l 'scsi.*'
- -L 和 -l 一样，但是会打印变量的相关信息。
- -v 打印出 stap 执行的各个阶段的信息，主要用于调试。
- -p stap 执行到第几个阶段。
- -k stap 工具不删除 /tmp/stapXXXX 下的 sources and kernel modules。
- -g 允许访问 kernel-space 的内存。注意这是非常危险的。
- -c COMMAND and -x PID 允许 trace 特定进程。
- -o FILE 输出到指定文件中

## Q & A

- Q: systemtap 安装问题
	- 参考我的这个 [blog](/2015/01/27/linux-systemtap-install/)

## 参考

- http://myaut.github.io/dtrace-stap-book/

[-10]:    http://hushi55.github.io/  "-10"
