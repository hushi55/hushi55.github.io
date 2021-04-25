---
layout: post
title: ebpf 今日头条 3
description: ebpf 最新的特性和 kernel 添加的 epbf 特性
category: code
tags: [linux, ebpf]
---
`今日头条`系列 3, 这些特性是在 2021 年 1 月份的。

## The Kernel Side
这个月 kernel 5.12 版本添加的新特性：

- eBPF 添加原子操作，也就是说，扩展了 eBPF 的指令集，添加一个新的 BPF_ATOMIC 模式，
  这个在 x86-64 eBPF JIT 下是原子支持的(其他架构的支持，留给熟悉这些架构的开发人员)。
  新指令如下：
  * atomic[64]_[fetch_]add
  * atomic[64]_[fetch_]and 
  * atomic[64]_[fetch_]or
  * atomic[64]_xchg
  * atomic[64]_cmpxchg 
    
  引入这个一个动机是这样可以为 eBPF 生成全局唯一的 cookies。
  但是这个原子操作也可能被其他应用有新的场景使用。
- 在 eBPF 程序中支持内核模块全局变量(__ksym externs)。这是内核 BTF 的一个持续改进。
  这个可以使用在 BTF-powered 原生跟踪点和跟踪 hook。
- 通用 eBPF stackmap's build-id 获取和添加支持有 build-ids 的 mmap2 性能事件(
  这个事件通过执行 mmap 记录生成，包含了足够多的原始信息来唯一标识共享 mappings。
  )  
-  支持从 eBPF 程序 sock_addr 中获取更多 SOL_SOCKET 级别的信息。
   为了弥补通过 `bpf_setsockopt()` 获取选项 list 和通过 `bpf_setsockopt()` 设置这些选项。
   有关选项有：
   * SO_MARK
   * SO_PRIORITY
   * SO_BINDTOIFINDEX (also new for bpf_setsockopt())
- 为 eBPF 提升了 out-of-tree 交叉自测。尽管这个没有添加新的特性，但是这个是非常有意思的一个报告。
  因为这个可以广泛的添加在 ARM 架构上的自动化测试。自动化是 eBPF 生态上非常重要的一个部分。
  
## Did You Know?: eBPF Virtual Filesystem
如一个 program 或者一个 map 就是一个 eBPF objects，保留在在 kernel 内存中直到这个对象不再被引用。
在 kernel 中这些对象通过一个引用计数器来跟踪，当这个引用计数器减到 0 时，这个对象就会被销毁。
应用这个 program 通常是通过用户 attached 这个程序(例如 tc filter 或者 kernel probe)，
或者一个文件描述符，通过 bpf() 系统调用加载一个程序。
同样，一个 eBPF map 引用可以由 eBPF 程序来保存，也可以由获取了这个文件描述符的用户程序来保存。

因此，如果一个进程加载了一个 eBPF 程序但是没有 attaching 它，
那么这个程序会在进程退出或者文件描述符关闭的时候销毁。
当前有多种方法在进程间共享文件描述符。但是为了在应用程序中更加容易的引用 eBPF objecs，
或者只是在 kernel 没有引用的情况下持久化这些对象，这样催生了另外一种机制：eBPF virtual filesystem。

eBPF virtual (or pseudo) filesystem，通常叫做 bpffs，一般情况下会挂在 /sys/fs/bpf 路径下，
但是其他的路径也是可以。这个能够 pin objecst 到 virtual filesystem 下，这个能通过文件路径来表达。
通过调用 bpf() 和 BPF_OBJ_PIN 子命令来 pin 一个 object，通过 BPF_OBJ_GET 子命令在 bpffs 路径下获取这个 pin object 的文件描述符。
移除 pinned 路径只需要简单的调用 unlink()，和正常的路径是一样的。
pinned 路径在重启后是不能持久化的。

请注意，句点(.)符号在 pinned 路径中是被限制的。这个文字之前从未使用过，
但是最近这个特性在特定的 eBPF 迭代器中重新被引入，maps.debug 和 progs.debug。
你可以使用任何其他字符在，像 `/sys/fs/bpf/🐝` 是有效路径。

这里有一个具体的列子。我们通过使用 bpftool 来创建一个 eBPF map。
因为没有程序使用这个 map，只能通过文件描述符来引用这个资源，当 bpftool 程序退出后。
为了避免 map 在这个阶段丢失， bpftool 使用一个命名的 path 来 pin 住这个 map。

```shell
# bpftool map create /sys/fs/bpf/🍯 type array key 4 value 32 entries 8 name honeypot
# bpftool --bpffs map show pinned /sys/fs/bpf/🍯
42: array  name foo  flags 0x0
        key 4B  value 32B  max_entries 8  memlock 4096B
        pinned /sys/fs/bpf/🍯
```

当我们重用这个 map 时：

```shell
# bpftool prog load bee.o /sys/fs/bpf/🐝 map name honeypot pinned /sys/fs/bpf/🍯
```

当然，咱们可以不使用 emojis。

注意，eBPF 中的一些其他对象资源(BTF，links，iterators)，这些对象的处理方式完全不一样。
也存在一些其他的方式引用一个程序和 maps，例如引用一个程序的 array maps 或者 maps of maps。

[-10]:    http://hushi55.github.io/  "-10"
