---
layout: post
title: linux network stack
description: linux network stack 介绍
category: code
tags: [linux, kernel, netwrok, systemtap]
---
## linux network stack 介绍
网络子系统是 linux 中最大的一个子系统，在不包括网卡驱动的情况下，光是 C 语言的内核代码就超过了 15Mib。


## linux network 在 kernel 中的组织
首先我们来看看一个 package 在 network 的流动路径：

![](http://myaut.github.io/dtrace-stap-book/images/net.png)

从上图中可以看到 kernel 对于 network 子系统的实现主要是分为 3 层：

- socket layer：主要是应用层的接口
- Intermediate protocol：中间协议层，列如：ip，udp，tcp
- Media Access Control (MAC) layer：设备驱动层，主要是控制网卡

网卡和驱动通过 DMA(direct memory access) 维护着 ring buffer，我们可以看看 ring buffer 是如何工作的：

![](http://myaut.github.io/dtrace-stap-book/images/ringbuf.png)

ring buffer 通过 tail，head 两个指针来表明数据的移动。

看完了 package 在 kernel 中的流动路径，我们来看看 kernel 是如何组织代码的：

![](http://myaut.github.io/dtrace-stap-book/images/linux/net.png)

- socket：主要组织和应用层相关的数据，如：VFS node 等
- sock：主要组织网络相关的数据：本地网络地址等
- net_device：主要包括网络设备的相关数据
- sk_buff：network 子系统中最主要的数据，代表了 package 

清楚了代码的结构后，我们看看 package 数据在函数的流动

TCP：

- kernel.function("tcp_v4_connect")：连接到远程节点
- kernel.function("tcp_v4_hnd_req")：接受远程连接
- tcp.disconnect：断开连接
- tcp.sendmsg：发送数据
- tcp.receive/tcp.recvmsg：接收数据

ip：

- kernel.function("ip_output")：发送数据
- kernel.function("ip_rcv")：接收数据

Network device：

- netdev.transmit/netdev.hard_transmit：发送数据
- netdev.rx：接收数据

## network in systemtap
这里主要讲解些 systemtap 中跟踪 network stack：

## 参考

- http://myaut.github.io/dtrace-stap-book/kernel/net.html

[-10]:    http://hushi55.github.io/  "-10"
