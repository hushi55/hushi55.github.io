---
layout: post
title: Golang 源码分析 - network 
description: Goroutine 源码分析 - network 
category: code
tags: [linux, Golang]
---

网络部分是 golang 调度器的一个亮点，应为在这之前要实现高性能的网络程序，
大部分使用的是 linux 的 epoll 或者 bsd 的 kqueue 技术，
这些技术有一个共同的特点就是要使用异步回调的编程方式了，异步回调的最大的劣势就是理解和维护相当的困难，
golang 网络部分也是使用的 epoll/kqueue 技术，但是正是由于golang 的 goroutine 调度器，
将原本的异步回调的编程模式改变成了同步的方式，这样大大减轻了程序员的心智负担。

## 相关数据结构


## 内部逻辑

##


## 参考

- [The Go netpoller](http://morsmachine.dk/netpoller)

[-10]:   	 http://hushi55.github.io/  "-10"