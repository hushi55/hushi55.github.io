---
layout: post
title: K8S pod lifecycle
description: 介绍 kubernetes pod TERM
category: blog
tags: [linux, kubernetes, network]
---
之前一直做 kubernetes 网路相关的工作，为了系统的学习 kubernetes 网路相关知识。
将之前的工作做一个记录，方便作者自己查找。

## 问题
在使用 cloud 环境上的 kubernetes 时，在压测过程如果对一个非标准容器，如 kata 等，
有可能出现流量中断等情况，对于这样等问题，我们需要详细了解 pod 的生命周期，
这篇文章就是对 pod terminate 的一个详细介绍。

## 分析
由于 Pods 代表一组进程运行在集群的 nodes 上。当 Pods 不在被使用(不是通过发送 KILL 信号量，没有机会做任何清除动作)，
优雅关闭 Pods 是非常重要的。

设计的目的是让我们知道能够删除请求并且知道进程如何关闭，而去还可以确保删除一定能完成。
当我们要求删除一个 Pod 时，集群会记录和跟踪这个 grace period，在 Pod 被运行强制 killed 之前。
当强制关闭后，kubelet 将试图正常关闭这个 pod。

通常，容器运行时组件会发送 TREM 信号给容器的每一个主进程。很多容器运行时在构建 images 时使用 STOPSIGNAL 来定义，
并且发送这个代替 TERM。一旦 grace period 时间到达，KILL 信号将被发送到甚于的进程汇中，随后 Pod 会被 API server 删除。

整体的流程如下：

1. 当我们使用 kubectl 工具手动删除一个指定的 pod 时，将会有默认的 grace period 时间(30秒)
2. 当经过 grace period 后，这个 pod 在 API server 中会被更新为 dead。
   如果我们使用 kubectl 来查询这个我们删除的 pod，
   这个 pod 将显示为 Terminating。这个这个 pod 运行的 node 上，随后 kubelet 将看到这个 pod 被标记为 terminating，
   (优雅关闭时间被设置)，kubelet 开始如下流程关闭这个本地 pod。
   1. 如果 pod's 的容器定义了 preStop hook，那么 kubelet 就在这个容器中运行这个 hook。
      如果这个 preStop hook 在 grace period 时间到期后，依然在运行，
      那么 kubelet 将又一个比较短的时间在 grace period 之外，值为 2 秒。
   2. kubelet 将向容器发送 TERM 信号到容器的 1 号进程中。
3. 在开始优雅关闭的同时，控制面将移除将要关闭的 pod 从 Endpoints(如果有 EndpointSlice)等对象，
   配置这个 pods 选择其的 service。ReplicaSets 和其他 workload resources 资源将不在将这个 pod 定义为可用的，
   pod 即使关闭比较慢， load balancers 将一直不会有流量导入到移除的 pods 上，在优雅关闭一开始。
4. 当 grace period 到期，kubelet 将发送强制关闭。向容器发送 SIGKILL 信号，只要在 pod 中还在运行的容器。
   如果容器启动使用了 pause container，那么 kubelet 也会清除这个隐含的容器。
5. kubelet 出发强制移除 pod 对象在 API server 中，如果设置了 grace period 为 0 那么会立即执行。
6. API server 删除 pod api 对西那个，这个在任何 client 中就无法访问。

```text
注意，如果 preStop hook 需要一个比默认 grace period 长的时间来运行，
那么我们必须设置 terminationGracePeriodSeconds 这个参数
```

```text
在 pod 中的容器，收到 TERM 信号会是不同的时间，因为这个发送的信号的顺序是随机的，如果希望是有顺序的关闭，
可以考虑使用 preStop 来保证
```


![](/images/k8s/pod/kubectl-TERM.png)


## 参考

- [official documentation](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [K8S V1.0.0 design docs](https://github.com/kubernetes/kubernetes/blob/v1.0.0/docs/networking.md)
- [The Kubernetes Network Model](https://k8s.networkop.co.uk/arch/)

[-10]:    http://hushi55.github.io/  "-10"
