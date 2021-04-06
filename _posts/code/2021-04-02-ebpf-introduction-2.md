---
layout: post
title: ebpf 介绍 2
description: linux ebpf 相关介绍
category: code
tags: [linux, kernel, ebpf]
---

## ebpf
接上文[ebpf](/2021/04/01/ebpf-introduction-1)的介绍，我们继续聊.
ebpf 由以下几个模块组成

- RISC instruction set ---> 一个精简指令集
- maps ---> 高性能存储 key/values 设施
- helper functions ---> linux kernel 通信机制
- tail calls ---> 调用其他 bpf 程序
- pinning objects ---> 虚拟文件系统
- offloaded  ---> 提升性能的一种机制

## RISC Instruction Set
ebpf 被设计为一个 RISC 精简指令集，可以使用 C 语言子集合编写，通过编译器(LLVM)编译。
随后 linux kernel 可以很简单的通过 JIT 编译 ebpf 程序为 native code 在各种 cpu 上执行，
这样可以保证 ebpf 的性能。这样设计的优点有：

- 单独设计为 RISC 精简指令集，可以保证 kernel 的可编程性，打破 kernel 和 user space 的边界
- 给出一种可扩展性的 data path 编程方式，这样可以高度优化程序的性能
- 在网络域内，可以在不重启 kernel 的情况下更行 ebpf 程序，而且没有流量中断。
- ebpf 提供了稳定的 ABI，保证 ebpf 能够在新版本的 kernel 中运行，完全向下兼容
- ebpf 通过前置的校验器保证ebpf 程序在 kernel 中的运行的稳定性，不会引起 kernel crash

ebpf 程序总是通过 event-driven 来运行的。

ebpf 包含 11 个寄存器，一个 512 字节的 stack space。

- R10  ---> 唯一一个只读寄存器，是栈贞指针寄存器
- R0   ---> return values 寄存器
- R1-R5 ---> 函数调用参数寄存器
- R6-R9 ---> 函数调用者寄存器，主要用户 helper function 现场保存

ebpf 程序的一些限制

- 4096 个指令限制(kernel version < 5.1)
- 1M 个指令限制(kernel version >= 5.1)
- 禁止使用循环，保证在 kernel 中有限的时间 ebpf 程序运行完毕，时间可控
- 可以使用 ebpf tail call，但是最多也只能有 33 个 tail call

## Helper Functions
![](/images/ebpf/ebpf_helper-6e18b76323d8520107fab90c033edaf4.png)

eBPF 不能直接调用 kernel 的函数，因为这么做会导致 eBPF 会和 kernel 的版本绑定，
导致向下兼容非常困难，调用 kernel 函数的能力是通过 helper functions 来实现的，
这样通过保证 helper functions 的 ABI 的稳定性来保证 eBPF 的向下兼容性。

- 调用随机数函数 
- 获取当前时间和日期
- eBPF map 读写操作
- 获取当前 进程/cGroup 上下文
- 操作网络数据包

## Maps
![](/images/ebpf/ebpf_map_architecture-e7909dc59d2b139b77f901fce04f60a1.png)
map 是一个高性能 key/value 存储系统，这个是在 linux kernel 中实现的。
map 的主要用途是在 ebpf 和 ebpf，以及 ebpf 和 应用程序中共享数据。
当前一个 ebpf 能使用 64 中不同类型的 map。

- generic maps
  - BPF_MAP_TYPE_HASH
  - BPF_MAP_TYPE_ARRAY 
  - BPF_MAP_TYPE_PERCPU_HASH
  - BPF_MAP_TYPE_PERCPU_ARRAY
  - BPF_MAP_TYPE_LRU_HASH
  - BPF_MAP_TYPE_LRU_PERCPU_HASH
  - BPF_MAP_TYPE_LPM_TRIE
- non-generic maps
  - BPF_MAP_TYPE_PROG_ARRAY
  - BPF_MAP_TYPE_PERF_EVENT_ARRAY
  - BPF_MAP_TYPE_CGROUP_ARRAY
  - BPF_MAP_TYPE_STACK_TRACE
  - BPF_MAP_TYPE_ARRAY_OF_MAPS
  - BPF_MAP_TYPE_HASH_OF_MAPS

## Others

### eBPF Safety
通过上面的介绍的可以知道 eBPF 是一种可编程的 kernel 技术，那么如果 eBPF 不安全将影响 kernel 的稳定性。
eBPF 是通过下面的手段来保证 eBPF 程序对于 kernel 是安全的。
#### Required Privileges
只有  privileged mode (root)/capability CAP_BPF 权限的程序来能 load 和 run eBPF 程序。
#### Verifier
![](/images/ebpf/ebpf_loader-7eec5ccd8f6fbaf055256da4910acd5a.png)
当 eBPF 程序被加载后，会通过 eBPF verifier 来校验 eBPF 程序是否满足以下要求

- eBPF 程序不能存在死循环和 block kernel 的代码
- eBPF 程序不能包含未初始化的变量
- eBPF 程序必须是有限的大小，不能太大
- eBPF 程序必须有限的复杂性

#### Hardening

- Program execution protection
  * eBPF 程序加载完毕后，kernel 将设置 eBPF 程序为只读。
- Mitigation against Spectre
  
- Constant blinding
  * 所有的 eBPF 程序常量在加载后 blinding，防止通过常量注入可执行代码，阻止 JIT 攻击。

#### Abstracted Runtime Context
eBPF 不能直接访问 kernel 中的任意内存，只能通过 helper function 来访问上下文之外的数据。
如果在安全的条件， eBPF 程序能够修改某些数据。

### Object Pinning
![](/images/ebpf/bpf_fs.png)
ebpf 程序和 map 本质上都是 linux kernel 中的一个种资源。
当 ebpf 需要和其他 ebpf 或者 应用程序共享这些资源时，可以通过 linux 的文件描述符来通信。
但是这个缺点也是明显的，比如用 tc 加载的 ebpf 程序，tc 加载完毕，生命周期也就结束了，
这时 map 资源无法被外部的用户应用程序共享。所以 linux kernel 实现一个最小集合的文件系统。
这个文件系统就是 object pinning，通过这个技术就可以使用 linux 匿名文件系统来访问这些资源。

### Tail Calls
![](/images/ebpf/ebpf_tailcall-106a9d37e6b2b88e24b923d96e852dd5.png)
如图所示，tail calls 是一种 ebpf 程序调用另外一个 ebpf 程序，但是这个调用不像普通的函数调用，
tail calls 不会返回上一级调用，并且没有普通函数调用的寄存器 push/put 消耗，看起来就是一次 long jump，
两个 ebpf 函数使用的是同一个栈空间。
使用 ebpf tail call 技术，只需要做以下两点

- 设置 `BPF_MAP_TYPE_PROG_ARRAY` key/values program array
- 通过 `bpf_tail_call()` 来引用第一步设置的 `BPF_MAP_TYPE_PROG_ARRAY`

kernel 将直接运行 `BPF_MAP_TYPE_PROG_ARRAY` 中指令，`BPF_MAP_TYPE_PROG_ARRAY` 对于 user space 是只写的。

### BPF to BPF Calls
![](/images/ebpf/bpf_call.png)

### JIT
![](/images/ebpf/bpf_jit.png)

### Offloads
![](/images/ebpf/bpf_offload.png)


## 参考
- [ebpf.io](https://ebpf.io/)
- [cilium](https://docs.cilium.io/en/stable/bpf/)
- [New GKE Dataplane](https://cloud.google.com/blog/products/containers-kubernetes/bringing-ebpf-and-cilium-to-google-kubernetes-engine)


[-10]:    http://hushi55.github.io/  "-10"
