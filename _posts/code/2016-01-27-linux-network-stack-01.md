---
layout: post
title: Linux Network Stack 系列 01
description: Linux 网络栈系列文章第一篇
category: code
tags: [linux, Network]
---
从这篇文章开始，我试图写一个系列关于 Linux Network Stack 的文章，看看能不能讲清楚一个网络包从网线到达应用程序的整个过程。
首先我们将这个过程分下类，这个过程主要涉及 Linux Kernel 部分和 User Space 部分。

- 网卡 <----> 协议栈： package 到达网卡是交给 kernel的过程
- kernel 内部处理：主要是 TCP 的状态机的分析
- 协议栈 <---> 应用程序：package 数据经过协议栈处理到达用户态空间

这篇文章首先尝试解释下 网卡 <----> 协议栈 边界发生的事情。

## 网卡/协议栈 边界的读/写数据过程
下面我分别看看这两个过程是怎么回事：

![](/images/blog/network/nic_network_stack.png)

下面我分别看看收包和发包的过程。

### 数据包的接受过程
上图中我们的收包过程是蓝色线条，数据包的接收，从下往上经过了三层：网卡驱动、系统内核空间，最后到用户态空间的应用。现在来详细解释下：

- 当一个新的数据包到达，NIC(network interface controller)调用 DMA engine，通过Ring Buffer将数据包放置到内核内存区。
- 一旦数据包被成功接收，NIC发起中断，由内核的中断处理程序将数据包传递给IP层。
- 经过IP层的处理，数据包被放入队列等待TCP层处理。每个数据包经过TCP层一系列复杂的步骤，更新TCP状态机，
- 最后到达 recv Buffer，等待被应用接收处理。

我现在解释几点：

- Linux内核使用 sk_buff(socket kernel buffers)数据结构描述一个数据包。
- Ring Buffer的大小固定，它不包含实际的数据包，而是包含了指向sk_buff的描述符。当Ring Buffer满的时候，新来的数据包将给丢弃。
- 从 NIC 中内存的 package 数据可以不经过 CPU 直接拷贝到 Kernel 中的内存，这个过程就是 DMA：Directional Memory Access，主要用于快速数据交换。
- 从上图中可以看到 DMA 操作了 kernel 中的一块内存，这块内存其实是 Device Driver 注册的时候向 Kernel 提前申请的。
- 最后需要注意，数据包到达 recv Buffer，TCP就会回ACK确认，既TCP的ACK表示数据包已经被操作系统内核收到，但并不确保应用层一定收到数据（例如这个时候系统crash），因此一般建议应用协议层也要设计自己的确认机制。

### 数据包的发送过程
上图中红色的线条表示发送数据包的过程，和接收数据的路径相反，数据包的发送从上往下也经过了三层：用户态空间的应用、系统内核空间、最后到网卡驱动。

- 应用先将数据写入TCP send buffer，TCP层将send buffer中的数据构建成数据包转交给IP层。
- IP层会将待发送的数据包放入队列 QDisc(queueing discipline)。
- 数据包成功放入QDisc后，指向数据包的描述符sk_buff被放入Ring Buffer输出队列，随后网卡驱动调用DMA engine将数据发送到网络链路上。

## 其他问题研究
上面的数据包接受和发送的过程解释中只是理了大概，我现在列出一些其中的细节，我们可以后面写单独的文章具体分析。

- NIC 的内存大小如何，和 Kernel 中申请的内存是如何配合的？
- NIC 中的中断生成器是如何和 Kernel 配合工作的？
- 在整个处理过程中，数据的流动都给经过了那些 Linux Kernel 中的函数？

第三点的主要目的是熟悉 Kernel 的代码，
配合理解整个过程，这里我们可以使用 [systemtap](/2015/10/20/systemtap-tutorial/)工具来研究，
Github 上这样的项目：[tcpdive](https://github.com/fastos/tcpdive)


## 参考

- [Linux内核中网络数据包的接收-第一部分 概念和框架 ](http://blog.csdn.net/dog250/article/details/50528280)
- [Linux内核中网络数据包的接收-第二部分 select/poll/epoll](http://blog.csdn.net/dog250/article/details/50528373)
- [Linux TCP队列相关参数的总结](http://blog.sina.com.cn/s/blog_e59371cc0102vg4n.html)

[-10]:    http://hushi55.github.io/  "-10"
