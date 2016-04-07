---
layout: post
title: DPDK Overview
description: 实现 Maglev 单机性能的工具：DPDK
category: code
tags: [linux, network, ip/tcp, Load balance, DPDK]
---


## DPDK 介绍


## DPDK Libraries and Drivers 

- Memory Manager: Responsible for allocating pools of objects in memory. A pool is created in 
huge page memory space and uses a ring to store free objects. It also provides an alignment 
helper to ensure that objects are padded to spread them equally on all DRAM channels.  
- Buffer Manager: Reduces by a significant amount the time the operating system spends allocating 
and de-allocating buffers. The Intel® DPDK pre-allocates fixed size buffers which are stored in 
memory pools.  
- Queue Manager:: Implements safe lockless queues, instead of using spinlocks, that allow different 
software components to process packets, while avoiding unnecessary wait times. 
- Flow Classification: Provides an efficient mechanism which incorporates Intel® Streaming SIMD 
Extensions (Intel® SSE) to produce a hash  based on tuple information so that packets may be 
placed into flows quickly for processing, thus greatly improving throughput. 
- Poll Mode Drivers: The Intel® DPDK includes Poll Mode Drivers for 1 GbE and 10 GbE Ethernet* 
controllers which are designed to work without asynchronous, interrupt-based signaling 
mechanisms, which greatly speeds up the packet pipeline. 

### Memory Manager

Basic unit for runtime object allocation is the memory zone 
Zones contain rings, pools, LPM routing tables, or any other performance-critical structures 
Always backed by Huge Page (2 MB/1 GB page) memory 

### Buffer Manager

### Queue Manager

### Flow Classification

### Poll Mode Drivers

## 参考

- [Maglev：快速、可靠的软件网络负载均衡器 pdf](http://static.googleusercontent.com/media/research.google.com/en//pubs/archive/44824.pdf)
- [Google Maglev：基于商用服务器的负载均衡器](http://www.infoq.com/cn/news/2016/03/google-maglev)
- [从Maglev到Vortex，揭秘100G＋线速负载均衡的设计与实现](http://www.infoq.com/cn/articles/Maglev-Vortex)
- DPDK 分析 [1](http://www.cnblogs.com/jiayy/p/dpdk-memory.html),[2](http://www.cnblogs.com/jiayy/p/3430974.html)

[-10]:   	 http://hushi55.github.io/  "-10"