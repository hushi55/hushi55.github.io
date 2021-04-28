---
layout: post
title: K8S service
description: 介绍 kubernetes service
category: blog
tags: [linux, kubernetes, network]
---
service 是 kubernetes 中功能最强大的，同是也是最复杂对 kubernetes 的抽象。
因为对于第一次使用 kubernetes 的人来说，serivce 非常令人困惑。
下面将概述不同类型的 service，以及 service 和 集群其他要素和 APIs 的关系。

## service 的层级
思考和了解分布式 load-balancer kubernetes service 是非常好的一个开始，
和传统的 load-balancers，数据模型可以简化为以下两个要素：

1. 一组 backend：有相同 labels 的 pod 代表了一个 service，这个服务可以接收和处理传入的流量。
2. 暴露服务：每一组 pods 可以向集群内部，后者外部用户等多种不同方式暴露服务。

所有的 service 都实现了以上功能，但是单个可能使用不同的方式，对于自己独特的使用案例构建的。
为了理解各种类型的 service，下面有个表格来帮助我们理解，每一个类型都是构建在前一个类型之上。
下标展示了这样一个层级：

Type	        |描述		
--------------------|----|
**Headless**        |最简单的 load-balancing，仅仅通过调用 DNS，数据面不做任何处理，也没有 load-balancer VIP 分配。但是查询 DNS 将返回所有 backend pods 的 IP，这个最典型的使用案例是用户 stateful workloads(如：数据库)，客户端需要稳定和可预期的 DNS 名称，这样可以自行处理连接丢失和恢复转移 |
**ClusterIP**       |最常用的类型，为 backend 集合分配唯一一个 ClusterIP (VIP)。DNS 查询 service name 时 将返回这个分配的 ClusterIP。所有的 ClusterIPs 将在 node 节点上配置 DNAT 规则，目标 ip 为 ClusterIP 的将转换为 PodIps。这个 NAT 转换总是发生在 egress 节点上，这就意味着 Node-to-Pod 方向上的可达性，得有 CNI 来保证 |
**NodePort**        |构建在 ClusterIP service 类型之上，在 root namespace 中通过分配一个唯一的静态端口然后映射这个端口到后端 Pods 的端口上。进入的流量可以到达集群的任意节点上，只要目标端口匹配 NodePort，这个将会被转发到一个健康的 backend pods 上|
**LoadBalancer**    |外部用户流量到达 Kubernetes 集群时，LoadBalancer Service 会被分配一个唯一的，外部可路由的 IP 地址。这个可以通过 BGP 或者 ARP 来实现。这样类型的 service 通过 cloud L4 层 load-balancer 后者附件形式的 MetalLB， Porter 在 kubernetes 主 controller 之外来实现 |

```text
一些 service 可能没有 label 选择器，在这种情况下可以通过手动关联一系列的 backend pods。
这个通常被用于通过 service 和 kubernetes 集群外通信，集群内部依然依赖内部服务发现。
```

service's 内部架构是由两个送耦合的组件构成：

- kubernetes 控制面：由 kube-controller-manager 可执行文件运行集群内，对 API 事件做出反应，并且构建每一个 service 实例，
   内部表现形式是指定的 Endpoints，每一个 service 实例是由一系列后端 endpoints 组成(PodIP + port).
- 分布式的数据面：一组 node 级别的 agents，这些 agents 读取 Endpoints 对象在本地处理这些。这个通常由 kube-proxy 实现。
  也有一些完整的第三方实现，像 Cilium，Calico，kube-router 等。

一个即重要，又不重要的组件是 DNS。在内部，DNS 组件在集群中，仅仅 当查询 DNS-Based service 时
返回这个 service 和 endpoints 的缓存。

![](/images/k8s/service/k8s-service-net.png)

## 参考

- [official documentation](https://kubernetes.io/docs/concepts/cluster-administration/networking/#the-kubernetes-network-model)
- [K8S V1.0.0 design docs](https://github.com/kubernetes/kubernetes/blob/v1.0.0/docs/networking.md)
- [The Kubernetes Network Model](https://k8s.networkop.co.uk/arch/)

[-10]:    http://hushi55.github.io/  "-10"
