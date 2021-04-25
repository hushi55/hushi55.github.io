---
layout: post
title: linux 下 Salt 命令的疑难杂症
description: 使用 SaltStack Salt 命令时间很长的问题解决
category: code
tags: [strace, linux]
---
## 前言
今天运维同事在使用

```shell
salt '*' test.ping
```

两台机器上的执行时间完全不同。正常的为：

```shell
[root@salt_master ~]# time salt-key -L
Accepted Keys:
213
217
minion213
Unaccepted Keys:
Rejected Keys:

real    0m1.210s
user    0m0.732s
sys     0m0.339s
```

不正常的执行时间为：

```shell
[root@salt_master ~]# time salt-key -L
Accepted Keys:
213
217
minion213
Unaccepted Keys:
Rejected Keys:

real    0m41.134s
user    0m0.761s
sys     0m0.318s
```

相差太大了，不能接受，需要找出原因。遇到这种疑难问题，strace 就派上用场了。

## strace 的使用说明
首先我们看看 strace 的用法

```shell
[root@perf01 ~]# strace --help
strace: invalid option -- '-'
usage: strace [-dDffhiqrtttTvVxx] [-a column] [-e expr] ... [-o file]
              [-p pid] ... [-s strsize] [-u username] [-E var=val] ...
              [command [arg ...]]
   or: strace -c [-D] [-e expr] ... [-O overhead] [-S sortby] [-E var=val] ...
              [command [arg ...]]
-c -- count time, calls, and errors for each syscall and report summary
-f -- follow forks, -ff -- with output into separate files
-F -- attempt to follow vforks, -h -- print help message
-i -- print instruction pointer at time of syscall
-q -- suppress messages about attaching, detaching, etc.
-r -- print relative timestamp, -t -- absolute timestamp, -tt -- with usecs
-T -- print time spent in each syscall, -V -- print version
-v -- verbose mode: print unabbreviated argv, stat, termio[s], etc. args
-x -- print non-ascii strings in hex, -xx -- print all strings in hex
-a column -- alignment COLUMN for printing syscall results (default 40)
-e expr -- a qualifying expression: option=[!]all or option=[!]val1[,val2]...
   options: trace, abbrev, verbose, raw, signal, read, or write
-o file -- send trace output to FILE instead of stderr
-O overhead -- set overhead for tracing syscalls to OVERHEAD usecs
-p pid -- trace process with process id PID, may be repeated
-D -- run tracer process as a detached grandchild, not as parent
-s strsize -- limit length of print strings to STRSIZE chars (default 32)
-S sortby -- sort syscall counts by: time, calls, name, nothing (default time)
-u username -- run command as username handling setuid and/or setgid
-E var=val -- put var=val in the environment for command
-E var -- remove var from the environment for command
[root@perf01 ~]#
```

对于我们今天遇到的问题，我们重点关注下面的参数：

- -f：跟踪包括 fork 的子进程。
- -o file：输出跟踪的日志到一个文件中，而不是标准输出流中。
- -T：打印系统调用的时间。

## strace 的使用
我们使用下面的命令：

```shell
strace -f -T -o aa.txt salt '*' test.ping
```

我们得到的文本文件拷贝到 excel 中，按照 <，> 分列，使得系统调用时间在一列，然后使用 excel 的排序功能按照降序排列，我们可以看到下面的

```shell
4669  poll([{fd=3, events=POLLIN}], 1, 5000) = 0 (Timeout) 	5.005197
4669  poll([{fd=3, events=POLLIN}], 1, 5000) = 0 (Timeout) 	5.005197
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004221
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004221
4669  poll([{fd=4, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004206
4669  poll([{fd=4, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004206
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004201
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004201
4669  poll([{fd=4, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.00418
4669  poll([{fd=4, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.00418
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004177
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004177
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004166
4669  poll([{fd=3, events=POLLIN}], 1, 4999) = 0 (Timeout) 	5.004166
4669  select(0, NULL, NULL, NULL, {0, 25000}) = 0 (Timeout) 	0.025196
4669  select(0, NULL, NULL, NULL, {0, 25000}) = 0 (Timeout) 	0.025196
4669  select(0, NULL, NULL, NULL, {0, 25000}) = 0 (Timeout) 	0.025184
4669  select(0, NULL, NULL, NULL, {0, 25000}) = 0 (Timeout) 	0.025184
```

发现 poll 系统调用中存在大量的超时，我们现在可以拷贝其中一个

```shell
4669  poll([{fd=3, events=POLLIN}], 1, 5000) = 0 (Timeout)
```

到 aa.txt 中查找这个调用的上下文

```shell
4669  connect(3, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("202.96.199.133")}, 16) = 0 <0.000048>
4669  gettimeofday({1421912262, 387646}, NULL) = 0 <0.000038>
4669  poll([{fd=3, events=POLLOUT}], 1, 0) = 1 ([{fd=3, revents=POLLOUT}]) <0.000047>
4669  sendto(3, "K`\1\0\0\1\0\0\0\0\0\0\00234\003199\003106\003202\7in-a"..., 45, MSG_NOSIGNAL, NULL, 0) = 45 <0.000057>
4669  poll([{fd=3, events=POLLIN}], 1, 5000) = 0 (Timeout) <5.005197>
4669  socket(PF_INET, SOCK_DGRAM|SOCK_NONBLOCK, IPPROTO_IP) = 4 <0.000059>
4669  connect(4, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("202.106.196.115")}, 16) = 0 <0.000051>
4669  gettimeofday({1421912267, 394615}, NULL) = 0 <0.000037>
```

可以注意到其中连个链接的 ip 地址

```shell
...
... sin_addr=inet_addr("202.96.199.133")
...
... sin_addr=inet_addr("202.106.196.115")
```

这两个 ip 地址是这台 linux 上配置的 DNS，在主机上 ping 这俩个地址确实是 ping 不通，对比正常那台 linux 的 DNS 配置时，配置确实是不同的。修改到一致后，问题消失。至此使用 strace 调试问题也就完美结束了。

## 参考

- [http://www.ibm.com/developerworks/cn/linux/l-tsl/](http://www.ibm.com/developerworks/cn/linux/l-tsl/)

[-10]:    http://hushi55.github.io/  "-10"
