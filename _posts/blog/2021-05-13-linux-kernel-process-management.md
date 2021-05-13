---
layout: post
title: Process management
description: linux kernel 系列之 process management
category: blog
tags: [linux, kernel]
---


## Process tree in Linux
进程和线程的实现是通过通用数据结构 `task_struct`(`include/linux/sched.h`),
进程中的第一个线程被叫做 task 组 leader，其他线程通过 thread_node 节点来连接。
通过 task_struct 来引用，也就是 task_struct 是 task 组 leader。
子进程通过 parent 指针来引用父进程，通过 sibling 来链接其他节点。
父进程通过 children 来链接子节点。

task_struct 对象中的关系如下图：

![](http://myaut.github.io/dtrace-stap-book/images/linux/task.png)

task_struct 一些重要的属性：

- mm(指向 struct mm_struct) 引用这个进程的地址空间。例如：exe_file(指向 struct file) 引用可执行文件，
  arg_start 和 arg_end 是传递给进程的 argv 参数第一和最后一个字节
- fs(指向 struct fs_struct) 包含文件系统相关信息：path 指 task 的工作目录，root 指 root 目录(可以通过系统调用 chroot 改变)
- start_time 和 real_start_time 进程的实际运行时间
- files(指向 struct files_struc) 包含了进程打开的文件
- utime 和 stime 用户态和 kernel 态在 CPU 上的运行时间

## Lifetime of a process
下图是一个进程的生命周期和相应的探针点：

![](http://myaut.github.io/dtrace-stap-book/images/forkproc.png)

Unix 进程生成分为两个阶段：

- 父进程调用 `fork()` 系统调用。kernel 创建一个父进程的副本，
  包括地址空间(在 `copy-on-write` 模式下)，打开的文件，分配一个新的 PID。
  如果 `fork()` 调用成功，这个将返回在两个进程的上下文中，这个有同一个指令指针(PC 指针是一样的)
  在子进程中随后的代码通常用来关闭文件，重置信号等。
- 子进程调用 `execve()` 系统调用，这个将使用新的 based 传递给 execve() 来替换掉进程的地址空间。

当调用 `exit()` 系统调用，子进程将结束。
但是，进程也可以会被 `killed`，当 kernel 出现不正确的条件(引发 kernel oops) 或者机器错误。
如果父进程像等待子进程结束，这个可以调用 `wait()` 系统调用(或者 `waitid()`),
`wait()` 调用将收到进程的退出码，随后关联的 `task_struct` 将被销毁。
如果父进程不像等待子进程，子进程退出后，这个将被作为僵尸进程。
父进程可能会收到 kernel 发送的 `SIGCHLD` 信号。


## 参考

- [Process management](http://myaut.github.io/dtrace-stap-book/kernel/proc.html)

[-10]:    http://hushi55.github.io/  "-10"