---
layout: post
title: ebpf 今日头条 1
description: ebpf 最新的特性和 kernel 添加的 epbf 特性
category: code
tags: [linux, ebpf]
---
后面我将翻译一系列的 ebpf 相关的文章，我将其命名为`今日头条`系列，
其中原文来自于[ebpf.io](https://ebpf.io/blog) ，翻译这个系列的目的是由于 ebpf 是 kernel 中高速发展的子模块，
每天，每个月都有可能有很有 power 的特性加入，所以我们应该熟悉和了解这些最新的特性。

## The Kernel Side
kernel 5.11 版本添加的新特性：

- 扩展 BTF 基础在 kernel 中支持 laoding 和  validation 对于 `split BTF objects`。
  对于 kernel modules 来说这个是生成 BTF 的前置条件。
- 在 LLVM 内联分支条件生成模式下支持 packet 越界识别(ctx->data_end)，避免拒绝某些有效的程序。
- 添加一个新的 map 类型 `BPF_MAP_TYPE_TASK_STORAGE`。为 `eBPF LSM` 提供基于 task_struct 的本地存储。
  因此添加了三个 helpers: `bpf_task_storage_get()`, `bpf_task_storage_delete()`, `bpf_get_current_task_btf()`
- 对于 `per-socket local storage` 支持 `FENTRY`/`FEXIT`/`RAW_TP` 追踪程序使用基础设施(map and helpers)
- 添加了 `XDP` 批量 APIs，这个特性通过引入 `defer`/`flush` 机制为 `XDP_REDIRECT` 路径优化了性能。
- 取消了 `hash tables` `key` 大小限制，当前的 key 的大小突破 `MAX_BPF_STACK` (512 bytes)。
  这个改进了某些基于 `per-CPU` maps 案例，例如：实现基于文件路径的 allow/deny 案例。
- 修复了工具 `bpftool` `runqslower` `out-of-tree` 构建。这个能够构建这个工具在不同的架构上，在同一个源码树上。

## Libbpf
当前正在改进 iproute2，让其通过 libbpf 来处理 eBPF 程序。
Libbpf 当前全面的支持加载和管理 eBPF objects (programs, but also BTF descriptions)。
例如 tc 等其他工具也将受益，但是就如 LWN 中总结的，在最佳传输 library 方式的途径上还是存在一定的分歧。

`个人针对这个 features 的理解是：Libbpf 将成为 ebpf 程序加载和管理的标准方式`


[-10]:    http://hushi55.github.io/  "-10"
