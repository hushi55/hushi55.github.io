---
layout: post
title: Google's Maglev analysis
description: Google's Maglev 分布式负载均衡器秘密的分析
category: code
tags: [linux, network, ip/tcp, Load balance]
---
## Maglev 介绍
Maglev 是 Google 在 2008 研发并且使用在自身的生产环境中的负载均衡器，Google page 中给出的数据是，安装后不需要预热5秒内就能应付每秒100万次请求。
谷歌的性能基准测试中，Maglev实例运行在一个8核CPU下，网络吞吐率上限为12M PPS（数据包每秒）。如果Maglev使用Linux内核网络堆栈则速度会慢下来，吞吐率小于4M PPS。
在已经存在了 F5，LVS 这些硬件或者软件负载均衡器的情况下，Google 为什么要重复制造轮子，自己研发呢？一般考虑这样问题，无非是一个原因：成本。Google 一直以来都是崇尚使用简单的 X86
服务器单间分布式的系统来解决高并发，高负载的系统。以 F5 为代表的硬件负载均衡器可能会满足 Google 的包并发和高负载的网络应用，但是这样的硬件系统，授权费用奇高。
像 Google 这么的服务器集群的情况下，不太可能会使用这样的商业硬件解决方案。而已 LVS 代表的开源软件解决方案，通常以active-passive模式部署提供1＋1冗余，
使其中一个闲置，造成容量浪费。这样也不符合节约成本的这个理念。我们可以看看这两方案的对比效果图：

![](/images/blog/network/Maglev_lvs.png)

## 分布式 Load balance 需要解决的主要问题
分布式一般需要的解决的问题都是 High Availability 和 Scaling。

### High Availability 
我们来看看 Load Balance 这个特定业务场景下 High Availability 这个问题。四层负载均衡器的主要功能是将收到的数据包转发给不同的后端服务器，
但必须保证将五元组相同的数据包发送到同一台后端服务器，否则后端服务器将无法正确处理该数据包。以常见的HTTP连接为例，如果报文没有被发送到同一台后端服务器，
操作系统的TCP协议栈无法找到对应的TCP连接或者是验证TCP序列号错误将会无声无息的丢弃报文，发送端不会得到任何的通知。
如果应用层没有超时机制的话，服务将会长期不可用。一般的交换机或者负载均衡器都是采用取模算法来做负载均衡的算法。我们来看看各种情况下使用取模算法下服务器失效会造成什么影响。

#### 负载均衡器发生变化

![](/images/blog/network/LVS_Server_change.png)

上图中可以看到将有 87.5% 的链接发生变化。

#### 后端服务器变化的场景

![](/images/blog/network/LVS_RS_change.png)

#### 负载均衡器和后端服务器都变化

![](/images/blog/network/LVS_nginx_vortex.jpeg)

### Scaling

#### Scaling Out

#### Scaling Up

## 参考

- [Maglev：快速、可靠的软件网络负载均衡器 pdf](http://static.googleusercontent.com/media/research.google.com/en//pubs/archive/44824.pdf)
- [Google Maglev：基于商用服务器的负载均衡器](http://www.infoq.com/cn/news/2016/03/google-maglev)
- [从Maglev到Vortex，揭秘100G＋线速负载均衡的设计与实现](http://www.infoq.com/cn/articles/Maglev-Vortex)
- DPDK 分析 [1](http://www.cnblogs.com/jiayy/p/dpdk-memory.html),[2](http://www.cnblogs.com/jiayy/p/3430974.html)

[-10]:   	 http://hushi55.github.io/  "-10"