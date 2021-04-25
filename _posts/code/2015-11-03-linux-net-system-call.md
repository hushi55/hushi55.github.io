---
layout: post
title: linux net 
description: linux net stack 相关的系统调用解释
category: code
tags: [linux, kernel, net]
---
## linux epoll
epoll 的工作原理是 kernel 帮忙管理着大量的链接，并且通过驱动对调将已经发生网络时间的链接通过 list 管理起来。 epoll 主要有三个函数，
下面我们分别来看看：

### epoll_create

```cgo
#include <sys/epoll.h>;

int epoll_create(int size);
```

epoll_create 创建 epoll 对象。

- epoll_create 返回一个句柄
- size：参数只是告诉 epoll 要处理的一个大致数目，最新版的 linux 下会忽视这个参数。

### epoll_ctl

```cgo
#include <sys/epoll.h>

int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);

```

epoll_ctl 向 epoll 对象中添加敢兴趣的事件，epoll_wait 方法返回的感兴趣的事件必须是通过 epoll_ctl 添加的。

- int epfd：通过 epoll_create 返回的 epoll 对象
- int op：操作类型包括以下类型
	- EPOLL_CTL_ADD：向 epoll 对象中添加新的感兴趣事件
	- EPOLL_CTL_MOD：修改 epoll 中的事件
	- EPOLL_CTL_DEL：删除 epoll 中的事件
- int fd：待检测的套接字
- struct epoll_event *event：告诉 epoll 对什么类型的事件感兴趣，其中的类型有
	- EPOLLIN  ：表示对应的链接上有数据可以读出，tcp 链接的远端主动关闭也相当于读事件，因为要处理 FIN 包。
	- EPOLLOUT ：表示对应的链接上可以写入数据发送
	- EPOLLRDHUP ：表示 tcp 链接的远端关闭，或者半关闭
	- EPOLLPRI ：表示对用的链接上有紧急数据需要读取
	- EPOLLERR ：表示对应的链接发生错误
	- EPOLLHUP ：表示对应的链接被挂起
	- EPOLLET  ：表示将触发方式修改为边缘触发(ET)，系统默认为水平触发(LT)
	- EPOLLONESHOT ：表示这个事件只处理一次，下次需要处理需要重新加入 epoll 中


### epoll_wait

```cgo
#include <sys/epoll.h>

int epoll_wait(int epfd, struct epoll_event *events,
                      int maxevents, int timeout);
```

epoll_wait 收集监控事件中已经发生的事件。

- int epfd：epoll 对象
- struct epoll_event *events：分配的 epoll_event 数组，这里不能为 null，kernel 不负责为用户分配内存。
- int maxevents：最多收集事件的个数，一般是 epoll_event 数据的大小。
- int timeout：最多等待多少时间，单位是毫秒。




## 参考

- http://man7.org/linux/man-pages/man2/epoll_create.2.html
- http://man7.org/linux/man-pages/man2/epoll_ctl.2.html
- http://man7.org/linux/man-pages/man2/epoll_wait.2.html

[-10]:    http://hushi55.github.io/  "-10"
