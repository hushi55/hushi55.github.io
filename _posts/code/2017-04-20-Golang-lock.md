---
layout: post
title: Golang 源码分析 - lock 
description: Goroutine 源码分析 - lock
category: code
tags: [linux, Golang]
---


## 同步器要解决的问题

1. 获取同步状态
    
    1. 如果允许获取之
    2. 不允许阻塞之
     
2. 释放同步状态
    
    1. 唤醒阻塞的线程

        1. 独占锁和共享锁
        2. 线程阻塞后如果需要取消，支持中断，支持超时机制
        
        
实现锁的一些关键点


## Golang 系统提供的锁

1. 互斥锁
2. 读写锁
3. 

### Metadata 组织

### syscall 和 network 的问题

### goroutine 之间的数据同步问题

## 


## 参考


[-10]:   	 http://hushi55.github.io/  "-10"