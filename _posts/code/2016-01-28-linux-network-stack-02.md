---
layout: post
title: Linux Network Stack 系列 02
description: Linux 网络栈系列文章第二篇
category: code
tags: [linux, Network]
---
这是这个系列的第二篇文章，我们这一篇文章解释下  协议栈 <---> 应用程序 边界发生的事情，这个边界也是我们应用开发者涉及到的最多的地方。

## 流程分析
我们先看一个 package 到达 kernel 内核中后，package 是怎么交付给应用程序的：

![](/images/blog/network/network_stack_socket.png)

上图中我们以 socket 为中心，kernel 和 application 都是和 socket 交互。我们解析下上面的图：

- 当 skb 由 IP 层处理完进入到传输层后，会以 package 元组如：source ip，source port，dest ip，dest port 等信息查找哈希表。
- socket 找到后会获取 socket 上的锁，这个锁主要是保护元数据的：如 tcp 数据滑动窗口等。找到后就将 skb 排入 socket 的接收队列。
- 若是没有查到，就会将 skb 排入到 backlog 中
- application 中读取数据时，也要先获取锁，若是获取到就读取 socket 的接收队列中的数据，读完后会将 backlog 中的数据依次处理
- 若是没有获取到锁，那么会在 socket 的睡眠队列中等待。 

## select/poll/epoll
上面整个数据到用户缓存区的大概流程已经知道，那么我们在 linux 平台上使用得最多的 select/poll/epoll 是怎么回事呢？
我们以 epoll 为例看看下面这张图：

![](/images/blog/network/socket_epoll.png)

select/poll/epoll 所做的工作集中在 socket 的睡眠队列的唤醒上，我们都知道 epoll 是 linux 上高性能网络编程使用的技术，
那我们解释下它是如何高效的：kernel 将 skb 排入 socket 的接收队列后会去唤醒 socket 中的睡眠队列中的 Recv 例程。
我们知道唤醒操作会执行一个 callback 调用。在上图中可以看到，epoll 中的 callback 操作，就会将这个 skb 事件加入到 epoll 中的
ready_list 列表中。这样 epoll_wait 系统调用只需要去查找 ready_list 是否为空就知道了是否应该阻塞自己，
或者说是否应该加入到 epoll 的睡眠队列中。


## 其他问题研究

- linux 的 warkup 机制是如何实现的？
- backlog 队列如何调节，调节后的影响？

## 参考

- [Linux内核中网络数据包的接收-第一部分 概念和框架 ](http://blog.csdn.net/dog250/article/details/50528280)
- [Linux内核中网络数据包的接收-第二部分 select/poll/epoll](http://blog.csdn.net/dog250/article/details/50528373)
- [Linux TCP队列相关参数的总结](http://blog.sina.com.cn/s/blog_e59371cc0102vg4n.html)

[-10]:    http://hushi55.github.io/  "-10"
