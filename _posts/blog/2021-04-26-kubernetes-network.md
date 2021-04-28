---
layout: post
title: K8S Network
description: 介绍 kubernetes 网络模型
category: blog
tags: [linux, kubernetes, network]
---
之前一直做 kubernetes 网路相关的工作，为了系统的学习 kubernetes 网路相关知识。
将之前的工作做一个记录，方便作者自己查找。

## 定义问题
网路是 kubernetes 系统中核心的一个子模块，总体上提出下面 4 个核心需要解决的问题。

1. 容器 <--> 容器 之间的通信：这个通过 Pods 的设计和 localhost 来解决，默认解决。
2. Pod <--> Pod 之间的通信：通过 CNI 插件来解决。
3. Pod <--> Service 之间的通信：这个通过 services 来解决。
4. External <--> Service 之间的通信：这个通过 services 来解决。   

其中 `1` 着重解决本地容器通信问题 
`2` 着重解决东西向流量问题，
`4` 解决南北向流量问题，
`3` 解决高可用性问题。

## 几点要求
为了解决上述提出的 4 个问题，总体上提出下面三个要求：

1. 所有 pods 间的通信不通过 NAT。
2. 所有 pods 和 nodes 之间的通信不通过 NAT(反之亦然)。
3. pod 自身看到的 IP 和其他 pods 看到的 IP 是一致的。

### 目的和动机
提出上诉 3 个总的要求的动机和目的是什么呢？

- 容器化技术的普及是由 docker 带动的，早前 docker 的网路模型采用了 NAT 的方式来通信。
- port 形式的 NAT 通信将导致很多问题，
  * port 是紧缺资源容易发生用尽的时候
  * port 分配将导致调度器机器复杂
  * port 通信方式导致之前的微服务注册机制不兼容  
- 考虑到很多 IaaS 层使用的 VM 管理方式，采用这样的网路模型，能很好的兼容之前的管理方式    

## CNI 

### 主要目标
CNI 插件的目标和有[官方文档](https://kubernetes.io/docs/concepts/cluster-administration/networking/#the-kubernetes-network-model)
描述，下面是对其总结，CNI 插件需要完成以下两个主要的工作：

1. 连通性：确保每个 pod 有默认的 eth0 设备，并且 host 上的 root namespace 可以直达到 pod。
2. 可达性：确保从其他节点可以到达 pod，并且没有 NAT。

`连通性`是比较容易理解的，每一个 pod 必须有一个 NIC 来和外部网路通信。解决的是 Pod 和 host 上的网路问题。
在 Node 上的一些本地进程需要能从 root network namespace 到达 PodIP(如：执行 health 和 readiness 检查)，
因此需要 root NS 的连通性。

`连通性` 解决的集群内 Pod 的通信问题，以下是 CNI 插件为 `连通性` 可以使用的技术：

- ptp：在 root namespace 中创建 veth 设备，将其中一端安装到 Pod's namespace 中。
- bridge：如上，一端在 rootNS 中，一端在 bridge 上。
- macvlan/ipvlan： 使用相应的驱动程序直接连接容器在 Node 的 NIC 中。 

`可达性` 在另外一面上，可以需要做以下一系列事情：

- 每一个 Pod 可以从 Node 上配置的 PodCIDR 中获取为一个 IP 地址。
- 这个 IP 地址范围是在 Node 启动时，kubelet 初始化的。
- Nodes 是不知道其他节点分配的 PodCIDRs，分配由 controller-manager 管理，由 --cluster-cidr 参数指定。
- 根据 `连通性` 类型，建立 end-to-end 的`可达性`可能需要以下的方法：
    * 如果所有的 Nodes 在同一个 Layer2 下，`连通性` 可以通过配置静态路由的方式在所有 Nodes 上配置下一跳。
    * 如果所有的 Nodes 在不同的 Layer2 下，`连通性` 也可以通过如下方式：
        * 编排：通过使用 BGP 的方式，后者在 公有云 上使用静态路由的方式
        * overlay：VXLAN 一个流行的方式

### 次要目标
除了上述描述的目标，我们可能还需要做下面的事情：

- IP 地址管理，为每个 Pod 分配单独的 IP 
- 使用 Port mapping 为 Pod 暴露到外部
- egress/ingress 带宽控制
- 出集群的流量使用 source NAT(e.g. Internet)

上述功能可以通过一个整体的插件来实现，也可以通过插件链来实现，
多个插件的执行是通过配置文件在容器运行时顺序执行。

### IaaS
当前基本是 cloud 的环境，这个是趋势，因为云环境下提供了很多 kubernetes 需要的资源
VMs, L4 load-balancers 和 persistent storage (for PersistentVolumes)。
并且在网路这个子模块中，云环境下提供了基于 SDN 的可编程方式。

![](/images/k8s/network/CNI-iaas.png)

### calico

- 连通性：通过创建一个 veth 对，一端在 Pod's namespace 中，一端在 node's root namespace 中。
  对于每一个 local Pod，calico 设置 PodIP 对本地路由到 veth 设备上。
  
```text
calico CNI 创建到 veth 设备林外一端是没有 IP 地址的，
为了提供 Pod --> node 方向上的连通性，每一个 veth 对，需要设置 `proxy_arp` 参数，
这个使得 Pod 请求 root NS 的 ARP 请求都能够响应(假定 node 都有一个默认的路由指向自己)
```    
- 可达性：统一以下两种方式来建立
    1. 静态路由和 overlays：calico 支持 IPIP 和 VXLAN在 L3 子网边界设置 tunnels。
    2. BGP：这个是本地部署的最佳方式，这个是通过在每个节点上配置一个 `Bird BGP speaker`,
       设置两两通信传播每个节点上的路由信息。对于配置两两通信有都中方式，包括 `full-mesh`，`route-reflector`，`external peering`


下图演示了，使用 BGP-based 配置，使用了集群外的 route-reflector，IP 和 MAC 填充过程如下：

![](/images/k8s/network/CNI-calico.png)

### flannel

- 连通性：flannel 二进制文件负责这个，这个二进制文件是一个 metaplugin，通过委托其他 CNI 插件来工作，
  最简单的一个列子是，生成一个 bridge 插件，并且委托它来设置连通性。
- 可达性：通过 Daemonset 运行 flanneld 来工作，下面是工作时序：
    1. 查询 Kubernetes Node API 来发现本地的 PodCIDR 和 ClusterCIDR，这些信息将保存到 /run/flannel/subnet.env 中，
       随后会被 flannel 插件来生成本地的 IPAM 配置
    2. 创建一个名为 flannel.1 的 vxlan 设备，并且更新 Kubernetes Node 对象的 MAC 地址(以及自己的 IP 地址)
    3. 使用 Kubernetes API，发现其他节点的 VXLAN MAC，并且为这个 vxlan 设备构建本地 unicast head-end replication

```text
这个插件假定存在一个方式来交换相关信息(e.g. VXLAN MAC)，
以前这个要求独立的数据库来存储(托管的 etcd)，这种方式被认为是一个大的缺点。
现在最新的版本使用 Kubernetes API 来存储这个信息在 Node API object 中。
```

IP 和 MAC 填充过程如下：

![](/images/k8s/network/CNI-flannel.png)

### cilium

- 连通性：通过创建一个 veth 对，一端连接到 Pod's namespace，一端拦截到 node's root namesapce。
  cilium attaches eBPF 程序在 ingress TC 到勾子出，将来能够处理所有进入 pod 到网路包。
  
```text
注意在 root namespace 侧的 veth 一端是没有 IP 地址的，网路的连通性是通过 eBPF 转发到这个设备上的。
```  

- 可达性：这个实现不同于其他，依赖于 cilium 的配置：
    1. 在 tunnel 模式下，cilium 设置一个 VXLAN 或者 Geneve 设置同是将流量 forwards 到这个设备上。
    2. 在 native-routing 模式下，cilium 不做任何可达性设置，假定这个被外部设备实现。
       这个通常是在 SDN(如： cloud 环境)或者本地操作系统路由(本地环境)使用静态路由或者 BGP。

如下图所示，我们使用 VXLAN-based 配置，网路拓扑如下：

![](/images/k8s/network/CNI-cilium.png)

## 参考

- [official documentation](https://kubernetes.io/docs/concepts/cluster-administration/networking/#the-kubernetes-network-model)
- [K8S V1.0.0 design docs](https://github.com/kubernetes/kubernetes/blob/v1.0.0/docs/networking.md)
- [The Kubernetes Network Model](https://k8s.networkop.co.uk/arch/)

[-10]:    http://hushi55.github.io/  "-10"
