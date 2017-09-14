---
layout: post
title: Golang 源码分析 - memory
description: Goroutine memory
category: code
tags: [linux, Golang]
---

## Cgroup

- blkio — this subsystem sets limits on input/output access to and from block devices such as physical drives (disk, solid state, or USB).
- cpu — this subsystem uses the scheduler to provide cgroup tasks access to the CPU.
- cpuacct — this subsystem generates automatic reports on CPU resources used by tasks in a cgroup.
- cpuset — this subsystem assigns individual CPUs (on a multicore system) and memory nodes to tasks in a cgroup.
- devices — this subsystem allows or denies access to devices by tasks in a cgroup.
- freezer — this subsystem suspends or resumes tasks in a cgroup.
- memory — this subsystem sets limits on memory use by tasks in a cgroup and generates automatic reports on memory resources used by those tasks.
- net_cls — this subsystem tags network packets with a class identifier (classid) that allows the Linux traffic controller (tc) to identify packets originating from a particular cgroup task.
- net_prio — this subsystem provides a way to dynamically set the priority of network traffic per network interface.
- ns — the namespace subsystem.
- perf_event — this subsystem identifies cgroup membership of tasks and can be used for performance analysis. 


[-10]:   	 http://hushi55.github.io/  "-10"