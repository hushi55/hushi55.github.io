---
layout: post
title: linux trace
description: linux trace 总体介绍
category: code
tags: [linux, kernel, trace]
---
## linux trace 
linux trace 的工具很多，有些已经进入了 kernel，有一些没有，当遇到一个问题，需要使用一个 trace 工具时，我们该如何选择呢？

首先我们来看看 linux 有哪些可用的 trace

![](http://www.brendangregg.com/blog/images/2015/tracing_ponies.png)

基本上可以开个动物园了！

回答上面这个问题，我一般从这些方面来考虑：

- 是否进入了 kernel，进入 kernel 表明比较稳定。
- 是否可以支持编程，支持编程表明有一定的灵活性。

## Brendan Gregg 的选择
对于上面的问题，我们来看看 [Brendan Gregg](http://www.brendangregg.com/blog/index.html) 是如何做的：

![](http://www.brendangregg.com/blog/images/2015/choosing_a_tracer.png)

Brendan Gregg 建议的学习顺序是：

- 1. ftrace
- 2. perf_events
- 3. eBPF
- 4. SystemTap
- 5. LTTng
- 6. ktap
- 7. dtrace4linux
- 8. OL DTrace
- 9. sysdig

## 参考

- http://www.brendangregg.com/blog/2015-07-08/choosing-a-linux-tracer.html

[-10]:    http://hushi55.github.io/  "-10"
