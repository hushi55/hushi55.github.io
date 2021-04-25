---
layout: post
title: ebpf 今日头条 2
description: ebpf 最新的特性和 kernel 添加的 epbf 特性
category: code
tags: [linux, ebpf]
---
`今日头条`系列 2, 这些特性是在 2020 12 月份的。

## The Kernel Side

号外：
- iproute2 使用 libbpf 已经开始了。
- `Amazon's ENA` device 开始支持 XDP redirect (`XDP_REDIRECT` action)。

这个月 kernel 5.11 版本添加的新特性：

- kernel 模块支持 BTF，所以可以原生支持 BTF-powered raw tracepoints 跟踪点(`fentry`/`fexit`/`fmod_ret`/`LSM`)。
  程序使用 CO-RE attached，当前在 kernel 模块中开始支持。
- 添加新的 socket option `SO_PREFER_BUSY_POLL`, 这个可以使得切换到高负载下的 `busy-polling` 模式下，
  即使是在高负载下的 NAPI 上下文中，也可以强制使用 `busy-polling` mode。
  `busy-polling` mode这个也可以使用在 XDP sockets 中。
- 添加一个新的帮助函数 `bpf_ima_inode_hash()` 获取 IMA (Integrity Measurement Architecture) 节点的 hash 值。
  这个可以使用在 LSM (Linux Security Module) 中的 `fingerprinting` 文件，
  一个例子是：获取可执行文件的 fingerprints，可以监控这个可执行文件何时加载，链接，执行它们的。
- 添加一个新的帮助函数 `bpf_bprm_opts_set()` 在 LSM 模块中，
  这个可以修改 struct linux_binprm 中的某些 bit 位，这样就可以禁止使用某些环境变量，如：LD_PRELOAD 动态链接。
- 对于 eBPF objects 使用的 kernel 内存，从 memlock rlimit 切换到 cgroup-based 模式，
  rlimit 模式有很多缺点，而 cgroup-based 模式则更具灵活性，这样可以更好的控制内存和更加简单的方式获取使用的内存，
  也更加真实的反应出当前前的内存使用情况，但是 rlimit 就不一定是这样了。  
- 允许 `bpf_getsockopt()` `bpf_setsockopt()` 函数使用 ipv4 `BPF_CGROUP_INET4_BIND` 和 ipv6 `BPF_CGROUP_INET6_BIND` 探针
  这样可以控制 cgroups 类型的 listener sockets 的一些配置。
- 添加新的帮助函数 bpf_ktime_get_coarse_ns() 来使用 CLOCK_MONOTONIC_COARSE 获取 timestamp，
  这个比使用 CLOCK_MONOTONIC bpf_ktime_get_ns() 获取时间戳，有更高的性能，但是准确性没有那么高。

也有一些第三方提交的 features：

- 暴露 `bpf_sk_storage_get()` `bpf_sk_storage_delete()` 帮助函数，这样可以初始化或者删除 socket local storage
- 在 veth 设备上添加 AF_XDP 自测，对于 SKB 和 native 模式这个作为一个自测套件的一部分。
- 更新了 libbpf 的 `bpf_program__set_attach_target()`，使其支持 BTF-based 类型的探针(such as `fentry`, `fexit`, BTF-based tracepoints, etc.)
  就像其他类型的探针一样，可以通过 ELF 的 section 名称，这个名称宏 SEC() 来命名。
- 允许在栈上的指针用于 helper 函数上调用，如果用户有足够的权限，这样可以解决校验器错误的拒绝这样行的程序。
- 添加一个新的 libbpf API 函数来获取一个 eBPF ring buffer epoll 文件描述符。
  这个可以帮助 perf 类型的 buffer 迁移到 eBPF ring buffer。

## Did You Know?: CO-RE
CO-RE (一次编译，随处运行)是 tracing eBPF 程序保证可移植性的一种机制。
一个结构体中的属性在不同版本中，属性的相对地址可能是不同的。
tracing 程序可能会使用结构体中的相对地址获取属性的值，但是如果随后的内核版本中修改了结构体的大小，
或者调整了属性的顺序，这时这个 eBPF 程序将是不兼容的。

CO-RE 依赖 BTF 对象 (BPF Type Format) 来解决上述问题。
一个 BTF 对象包含程序的调试信息，实际上 BTF 是 DWARF 格式的简化版本，这个通常用于 GDB 调试。
BTF 对象被 kernel 加载后，一般会由 eBPF 字节码来存储这些信息，例如：程序被编译后 dump C 指令。
BTF 也可以描述用来描述其他对象，例如 kernel 自身。
这种情况下，在 eBTF 程序加载之前，就可以通过 kernel 自身的结构提前相关信息。
这样可以在 eBPF 程序发送到 kernel 之前通过 `ELF relocation` 这个步骤来调整程序。

通过 libbpf 是使用 CO-RE 最简单的途径。
注意，由于这个需要 kernel 的 BTF 信息，所以 CO-RE 只有在 kernel 编译开启 CONFIG_DEBUG_INFO_BTF 选项时才能生效。
当然最新的 LLVM, libbpf 工具也是必要的。


## 个人理解
个人对于上述特性的一个理解是：

1. eBPF 开始在安全领域发力，因为有 LSM 模块相关的改进
2. eBPF 开始大规模利用了，CO-RE 作为重要的工具开始在 kernel 支持。

[-10]:    http://hushi55.github.io/  "-10"
