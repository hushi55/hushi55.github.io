---
layout: post
title: trampoline introduction
description: trampoline 技术介绍
category: code
tags: [linux, kernel, ebpf]
---
trampoline 在接触 ebpf 技术后，我们会经常遇到的一个技术术语，对于这个技术，
我在网上查找了一些技术资料，尝试介绍这个技术，如果不对，欢迎斧正。

##  Changing the Control Flow in the System Call Handler
到目前为止，我们找到两个合适到为止来劫持系统的控制。
它们都出现在 kernel 2.6 版本中，因此有着非常好的可移植性和可用性。

![](/images/linux/trampoline-impl.png)

我们将通过无条件跳入 trampoline 来重写代码的选定部分。
trampoline 有几个工作。

1. 首先得保持栈，确保可以方便的访问系统调用的结果。
2. 随后，trampoline 会调用 hijack() 函数，这个会修改系统调用的结果(例如：ls 命令删除隐藏目录的记录)
3. 当 hijack() 执行完毕，返回 trampoline，需要恢复系统的状态到调用之前
    * 清理栈
    * 补偿在进入 trampoline 后的指令

## 总结

1. 替换的指令长度应该等于被替换的指令长度
2. 在 trampoline 中需要 push 参数到 hijack
3. hijack 函数调用完毕后需要清理 push 到参数
4. 补偿执行被替换到指令
5. 恢复跳转到被替换指令之后

## 参考

- [Hijacking the Linux Kernel](https://core.ac.uk/download/pdf/62916134.pdf)
- [Introduce BPF trampoline](https://lwn.net/Articles/804937/)

[-10]:    http://hushi55.github.io/  "-10"
