---
layout: post
title: network stack
description: linux kernel 系列之 network stack
category: blog
tags: [linux, kernel]
---
## Network stack
网络子系统是 kernel 最大的子系统，被叫做 stack 是因为由多种协议组成，
每一个协议构建在上一个协议之上。

### layer of network stack
网络协议的层级定义可以通过 OSI model 或者 TCP/IP stack。
当用户数据传输到网络层后，这些数据将被封装成协议：数据传递到协议层后，会在数据的头和尾带上额外的描述数据。
这样即使某些数据丢失或者传输过程中包的顺序打乱了，接收者能够根据这些额外的数据重建原始信息。

网络的每一层都有自己的职责，所有它们不关心更高层协议。
例如：IP 允许发送数据通过多个网络和路由器，它可以重组数据包，但是不保证数据的可靠性，
可靠性由 TCP 协议来保证。它们都可以传输原始数据，编码和压缩依靠更上次的协议实现，如 HTTP。

网络子系统和块存储系统最大的不同是：网络是延迟敏感的，所有 写/读 数据不能被延迟。
这也就是说，发送和读取数据通常在同一个线程上下文中。

网络栈在 unix 系统中大体上被划分为三个主要的层：

- Socket layer
- Intermediate protocol：IP，UDP，TCP，packet filters
- Media Access Control (MAC)

![](http://myaut.github.io/dtrace-stap-book/images/net.png)

### Ring buffer
网络被设计为发送巨量数据，所以如果是显示的发送每一次写的数据这种方式是低效的。
NIC 和 驱动程序通过维护一个 `shared ring buffer` 来代替单独的包处理。
驱动程序写数据到 `ring buffer`，NIC 网卡通过 DMA(direct memory access)来读取数据。
`ring buffer` 存在两个指针，head 和 tail：

![](http://myaut.github.io/dtrace-stap-book/images/ringbuf.png)

当驱动程序想通过队列方式传输数据时，它会将数据写入 ring buffer，然后更新 tail 指针。
当 NIC 发送数据时，会更新 head 指针。

### sk_buff structure
linux 中一般通过 `sk_buff` 数据结构在各层中共享数据：

![](http://myaut.github.io/dtrace-stap-book/images/linux/net.png)

`sk_buff` 中存在两个指针：head 和 data 指针指向协议的头。
数据长度保存在 len 属性中，包的传输时间戳保存在 tstamp 属性中。
`sk_buff` 通过 next 和 prev 构建一个双向列表。
网络驱动设备通过 net_device 属性保存。
一个 socket 通过下述结构对来表示：

- `socket` 保存了通常的 socket 数据，包括文件指针指向 VFS 节点。
- `sock` 保存了网络相关的数据，本地地址保存在 `skc_rcv_saddr` 和 `skc_num` 中，
  对方地址的保存在 `skc_daddr` 和 `skc_dport`。
  
## 参考

- [network stack](http://myaut.github.io/dtrace-stap-book/kernel/net.html)

[-10]:    http://hushi55.github.io/  "-10"
