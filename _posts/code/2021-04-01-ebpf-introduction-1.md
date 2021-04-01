---
layout: post
title: ebpf 介绍
description: linux ebpf 相关介绍
category: code
tags: [linux, kernel, ebpf]
---

## ebpf
之前一直有研究 linux 下的 dtrace 技术，包括 systemtap，ftrace，perf 等，但是进入 kubernetes 领域后在网络领域接触到了
cilium 项目，cilium 在 kubernetes 中体现出来优势太明显了，因此接触了 ebpf 技术。我在下面大概列出了 ebpf 相关的模块。
后面我详细介绍各个模块。

![](/images/ebpf/ebpf-introduction.png)

### 介绍
ebpf 是一种 linux kernel 可编程技术，主要聚焦在

- monitoring/observability, 
- networking
- security

从上面的简单描述中可以知道这个技术应该具备以下的特点

- 可编程  ---> 所以 ebpf 被设计成了一个 RISC 精简指令虚拟机
- linux  ---> 这个技术和 linux kernel 强绑定
- kernel ---> 要求这个技术必须保证 kernel 的稳定性和安全性

![](/images/ebpf/ebpf-runtime.png)

上图可以看出一个 ebpf 是如何在 linux kenerl 中运行的

1. 需要使用 LLVM 编译器将 C code 编译为 ebpf RISC 指令 
2. ebpf 校验器会校验这个 ebpf 程序是否对 kernel 是安全的 
3. ebpf JIT 将 ebpf 程序翻译为 native code 运行到 kenerl 的各个 probe 点

### Security
![](/images/ebpf/intro_security-e714bea99d4351c1097477e8920d94ec.png)

在 Security 领域，可以借助 ebpf 在 system calls 和 network filtering 两个方面
上的功能做出革命性的 Security 系统。

### Tracing & Profiling
![](/images/ebpf/intro_tracing-ffa5e3fa3407ecb445b1549f85f590f5.png)

### Networking
![](/images/ebpf/intro_networking-46255f740daa161407f59190a8774e9a.png)

### Observability & Monitoring
![](/images/ebpf/intro_observability-fcba5bd29e9179954764bb0ee9385905.png)


## 参考
- [ebpf.io](https://ebpf.io/)
- [cilium](https://docs.cilium.io/en/stable/bpf/)


[-10]:    http://hushi55.github.io/  "-10"
