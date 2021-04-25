---
layout: post
title: epoll level and edga trigggered 
description: epoll 水平和边缘触发模式解释
category: code
tags: [c, epoll, linux]
---
epoll 的工作模式

- LT模式：Level Triggered水平触发，这个是缺省的工作模式。同时支持block socket和non-block socket。内核会告诉程序员一个文件描述符是否就绪了。如果程序员不作任何操作，内核仍会通知。

- ET模式：Edge Triggered 边缘触发，是一种高速模式。仅当状态发生变化的时候才获得通知。这种模式假定程序员在收到一次通知后能够完整地处理事件，于是内核不再通知这一事件。注意：缓冲区中还有未处理的数据不算状态变化，所以ET模式下程序员只读取了一部分数据就再也得不到通知了，正确的用法是程序员自己确认读完了所有的字节（一直调用read/write直到出错EAGAIN为止）。

下面这副图很能解释这两种方式的区别：

![](/images/linux/et_lt.png)

- 0：表示文件描述符未准备就绪
- 1：表示文件描述符准备就绪

对于水平触发模式(LT)：在1处，如果你不做任何操作，内核依旧会不断的通知进程文件描述符准备就绪。

对于边缘出发模式(ET)：只有在0变化到1处的时候，内核才会通知进程文件描述符准备就绪。之后如果不在发生文件描述符状态变化，内核就不会再通知进程文件描述符已准备就绪。



## 参考
- [http://blog.csdn.net/chen19870707/article/details/42525887](http://blog.csdn.net/chen19870707/article/details/42525887)


[-10]:    http://hushi55.github.io/  "-10"
