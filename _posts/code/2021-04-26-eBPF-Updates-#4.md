---
layout: post
title: ebpf 今日头条 4
description: ebpf 最新的特性和 kernel 添加的 epbf 特性
category: code
tags: [linux, ebpf]
---
`今日头条`系列 4, 这些特性是在 2021 年 2 月份的。

## The Kernel Side
这个月 kernel 5.12 版本添加的新特性：

- 添加了一个本地的 eBPF CI 脚本。这样可以在本地构建和运行 eBPF 程序自测。
  但是运行脚本是在同一个 kernel 版本的 CI 运行框架，在提交的时候验证这些补丁。
  这样做的目的是让贡献者的本地机器上运行自测程序，在同样的环境中 CI，做回归检测。
  减少维护者和开发者之间的来回。如果你发布一个 bpf 或者 bpf-next patchs，就需要注意这个。
- 支持将已知大小的指针传递给全局函数。这个目的是为了突破 eBPF 函数最大 5 个入参的限制：
  额外的参数可以存储在 struct 中，使用一个指针指向这个结构体，传递给函数。
  这个结构体中可以包含指针，但是它不能在被调用者中解除引用。
  传递指针，在静态函数中是不支持的。(全局函数和静态函数是通过 BFT 信息在加载时决定的)。
- 为 task_vma 添加了一个迭代器，允许用户生成和 /proc/pid/maps 类似信息。
  但是为了使用它们需要做一些定制化，例如：当 VMA 使用一个 2MB 和 4KB 混合页，
  一个 case 是可以通过制定哪些地址使用 2MB 的页。
- 允许所有 sock_addr 相关的程序 hook 使用 bpf_getsockopt() bpf_setsockopt()，
  所以在各种可以的 attach 点上 cgroups 的监听 sockets，可以查询和修改 socket 的配置选项。
- 在一系列各种改进中，添加一种机制防止 `fentry`/`fexit` 递归 (将来可以扩展到 sleepable 程序中)。
  递归出现到一种场景是：当通过一个 eBPF 函数 tracing 一个函数时，这个程序自身调用了该帮助函数。
  另外一个补丁是，sleepable 程序可以使用 `map-in-map`，`per-CPU maps` 和相关统计。
  (在加载时，一些 tracing 和 eBPF LSM 程序可会通过调用 helper 函数来 sleep。)
- sleepable 程序可以使用 eBPF `ring buffers`。
- 扩展了校验器，使得其可以在 eBPF 程序的 stack 中通过偏移位置(offset)来读/写。
  例如：如果在 stack 上分配了一个数组，(在某些条件下)可以通过在编译时静态未知 index 但是加载时确定来读/写这个单元。
- 在 TC 和 XDP 程序重新设计了 MTU 处理方式，MTU (Maximum Transmission Unit) 在当前的 eBPF 程序中有时候过于保守。
  因为它们不会考虑 redirection 情况，所以会设置一个较小的值保证这个完全正确。
  为了改进这个限制，添加了 bpf_check_mtu() 函数来帮助我们主动查询 device's MTU，并且自身验证它。
- 扩展了 bpf_get_socket_cookie() 函数使其能在 tracing 程序使用使用，包括 sleepable 程序。
- 重构了代码并且稍稍提升了 AF_XDP sockets 的性能。在 libbpf 中添加了一个探针(将来可能会移动到 libxdp 中)，
  支持检查 kernel 支持的所有 features，并且选择一个效率最高的来设置这个 socket。
- 允许 BTF 包含 0 字节大小的 .rodata ELF sections。
  这个部分可能存储了初始化的只读变量，这些是编译器将全局变量存在在了 .rodata 部分。
  因为这个全局变量没有被初始化，所以在这个部分中的BTF 信息没有存在这些 debug 信息。
- 为 veth 添加了批量非配 socket buffers 函数 ndo_xdp_xmit()，这样大大提升 XDP 的性能。

## Did You Know? Program size limit
你是否直到 eBPF 程序限制的最大大小是多少呢？
你可能听过说 eBPF 被限制最多 4K 个指令，这个在早前做出了修改。

eBPF 程序的一个特性性是：在程序加载时，这个程序会被 kernel 强制校验，这个对于保证 kernel 稳定行和低延时是非常必要的。
如果允许长时间的 eBPF 程序将大大降低 kernel 的运行性能。如果 eBPF 程序中存在死循环，这个可能会使得 kernel hang 住。

为了避免这种情况，kernel 校验器会为可执行的路径构建一个有向无环图(DAG)，
确保每一个循环都是能够终止的。某些时候可能会存在一些分支重叠的情况，在某些的条件下，校验器会在第一次校验的时候，跳过这个校验。
这个称作 `state pruning`，如果没有这个机制，大量的指令下这个校验会非常到，导致加载非常慢，可能这个加载时间不能接受。

介绍 eBPF 时，有两个限制性的参数：

- 最大的指令数量：4096
- 校验器的复杂性：32768(32k)

第二个限制性参数代表了如果校验器检查指令的次数超过了这个数，这个 eBPF 程序将被拒绝加载。
你可以认为，这个是所有可执行路径的总和减去在分支路径上的修剪数。
如果一个程序的逻辑分支非常复杂，这个将需要校验更多的校验次数，即使程序的指令的决定数量少于 4K 也可能导致加载失败。

上面的两个限制在 Linux 5.2 中做出了改变。
复杂性限制参数被增加到 100 万个指令。这样最大指令数的限制也被简单的消除了。
这样程序的最大大小由 complexity 决定。程序最大指令数最大是 100万，这是一个硬性限制(如果没有任何 if 和 比较)，
实际上，这样的程序应该是不会存在的。程序拥有更多的分支，那么校验器就会更加复杂，那么运行的指令数量响应也会降低。

事实上 4096 个指令数量的限制没有消失，如果用户 eBPF 程序是通过 non-root(更加准确的说是，用户没有使用 CAP_SYS_ADMIN,
或者 CAP_BPF kernel version >= 5.8 ) 加载.

eBPF 程序的趋势是变得更加小，100 万个状态复杂性对于绝大数程序应该是足够的。
在一个高级项目中实现非常复杂的程序可能需要适配它，像 cilium 这样的项目就会定期适配校验器的要求。
有效突破复杂性的校验的方式包括 tail calls 和 bounded loops (Linux 5.3 引入)，
通过减少分支数量和校验器可以有效裁剪分支的重构代码也是一种有效方式。

硬件卸载又是另外一种方式了，因为程序需要适配硬件的内存，所有它具有完全不同约束。
这个边界又硬件能力和校验器共同设置，字节码的生成效率和 JIT 的执行效率共同发挥作用。

新的百万状态复杂性限制应该可以适合绝大部分的情况，最后程序可能确实存在一个限制：你的想象力!



[-10]:    http://hushi55.github.io/  "-10"
