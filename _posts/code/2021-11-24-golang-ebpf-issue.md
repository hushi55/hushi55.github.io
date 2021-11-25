---
layout: post
title: golang ebpf issues
description: 介绍 golang 语言使用 ebpf trace 中的各种问题和解决方案
category: code
tags: [linux, kernel, ebpf, trace]
---
将 ebpf 技术使用到 golang 程序中时，通常会遇到一些问题，这篇 blog 主要是收集这些问题和一些解决方案

##  Go crash with uretprobe
在 golang 程序中使用 uretprobe 有可能会出现程序奔溃到情况，这还不是最恶劣的情况，
如果程序没有奔溃也有可能出现程序带着脏数据执行，出现完全不可控到情况，
具体 [issue](https://github.com/iovisor/bcc/issues/1320) 可以参考

### why? 为什么会出现这种问题
golang 出现这种情况最主要到原因是 golang 特定的 goroutine 协程机制，
因为 goroutine 的原因，每个 goroutine 会有自己独立的 stack 空间，最开始的时候分配的大小为 2k，
但是如果 goroutine 的栈空间超过了 2k 这时 golang 程序会重新分配一个 4k 的栈空间，并且将之前 stack 
上的数据 copy 到新的 stack 上，这就是 golang 的连续栈分配方式。详细的介绍可以参考 [连续栈] 这篇文章。

其次由于 uretprobe 机制，这个可以参考我前面的[文章](/2021/05/19/trampoline-introduction)
从这篇文章可以知道，uretprobe 探针类型会使用 trampoline 蹦床机制，通过 JMP 指令插入自定义逻辑，
但是最后需要 JMP 回原地址，结合 golang 的 [连续栈] 机制，如果 goroutine 在调用过程发生了栈扩容/收缩
都会导致 JMP 回原地址是错误的，所以会导致 golang 程序崩溃或者不可遇知的错误。

### how? 怎么解决这个问题
我们知道 golang 在 uretprobe 探针奔溃的原因后，是不是 golang 程序就无法获取函数的返回值呢？
在这个 [issue](https://github.com/iovisor/bcc/issues/1320#issuecomment-407927542) 中，
提供了一个不依赖 uretprobe 获取返回值的解决方案。

- 不使用 uretprobe 探针
- 扫描源程序 ELF 文件，找到函数的开始位置，在所有 RET 指令位置注入 uprobe 探针，这样可以模拟 uretprobe

这个方案可以解决上述问题，并且还有一些性能优势，因为避免了 uretprobe 的开销

- 正常的函数调用: 2 ns/call
- 使用 uretprobe 函数调用 : 4 us/call
- 使用 2 uprobes (at enter + RET instructions): 3 us/call

上述数据使用简单的 libc 循环调用测试。

## 参考

- [Go crash with uretprobe](https://github.com/iovisor/bcc/issues/1320#issuecomment-407927542)

[连续栈]: https://tiancaiamao.gitbooks.io/go-internals/content/zh/03.5.html "连续栈"
[-10]:    http://hushi55.github.io/  "-10"
