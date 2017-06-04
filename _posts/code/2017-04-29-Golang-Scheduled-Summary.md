---
layout: post
title: Golang 源码分析 - 总结 
description: Goroutine 源码分析 - 总结
category: code
tags: [linux, Golang]
---


## Goroutine 调度器的优点

- 让网络程序的高性能和可编码性，比用 callback


## Goroutine 调度器的不足

- cacheline 失效，不具备 CPU 亲和性


## 设想

- 内存型的应用，redis memcache
- 网络应用，push，游戏
- 分布式应用
- 大规模的 GPU 应用程序(go 的调度器的游戏，自定义调度支持 GPU)

完全可以实现类似的 gogpu, gofpga 这样的关键字，将函数片段的运行 offload 到 gpu,
fpga 这样到计算核心上充分利用这样的硬件加速，这样大大减轻工程师在这个生态上到编程心智负担。


## 参考


[-10]:   	 http://hushi55.github.io/  "-10"