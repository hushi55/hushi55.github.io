---
layout: post
title: virtual memory
description: linux kernel 系列之 virtual memory
category: blog
tags: [linux, kernel]
---

## 一个例子

```cgo
char msg[] = "Hallo, world";    // mov %edi, $224cc
msg[1] += 4;                    // add (%edi), $4
```

上述例子中我们看到了编译器使用了一个绝对地址，考虑以下问题：

- 如果是单个进程运行，输出是:`Hello, world`
- 如果是多个进程运行，例如两个程序，第二个是不是会输出:`Hillo, world`

如果第二个程序输出是 `Hillo, world` 那么显然不符合预期，如果希望输出 `Hello, world`，就得满足两个条件:

- 不同进程的相同地址不能指向同一个物理内存单元
- 进程不能修改不属于自己的内存单元

`Virtual memory` 就是为了回答上述问题来设计的。

## Virtual memory

### page table
现代虚拟内存是基于 page 地址来管理的，所有的物理内存会分割为最小 page 单元(4k in x86)。
进程会以 `[BASE;BASE+PAGESIZE)` 映射到单独的一页。多个页的管理叫做 `page table`。
现代 CPU 提供大页管理，这个可以支持 M 甚至 G 大小。根据上面的例子，linux kernel 将设置进程的虚拟内存，
并且 copy 数据到物理内存中：

![](http://myaut.github.io/dtrace-stap-book/images/pagetable.png)

当第二个进程启动后，新的进程会分配单独的虚拟地址，所以数据会被单独 copy 到新的物理地址。但是使用的还是之前的地址。
当进程调度到 CPU，这时 page table 地址会被单独的存储到特定寄存器(如 CR3 on x86)。
所有地址将会被 CPU `Memory Management Unit` 单元翻译。

### segments
一个进程中虚拟地址，是以组的形式来管理的，这些组被叫做 `segments`：

![](http://myaut.github.io/dtrace-stap-book/images/pas.png)

当调用 `execve()` 后，进程的虚拟地址就被创建出来了，新创建的虚拟地址有 4 个特定的 `segments`：

- text segment：程序指令
- data segment：程序数据
- heap
- stack

进程的参数和环境变量会被 push 到 stack 上。

我们可以尝试使用 `malloc()` 来分配内存，标准 C lib 库使用 `brk()` 或者 `sbrk()` 系统调用。
程序也可以使用 `mmap()` 来映射文件到内存中，
如果没有传递文件参数给 `mmap()`，那么会创建一个叫做 `anonymous memory` 的特殊 `segment`。
这样的内存可用于内存分配器，这个是于程序无关的。

在 linux 咱们可以使用 `pmap` 或者 `/proc/PID/mapping` 文件系统来查看进程的虚拟地址。

### address space struct
linux 使用 `mm_struct` 结构体来管理虚拟地址：

![](http://myaut.github.io/dtrace-stap-book/images/linux/mm.png)

`vm_area_struct` 表一个 `segment`，其中 `vm_start` 代表 `segment` 开始位置，
`vm_end` 代表 `segment` 结束位置。
kernel 主要维护了两个主要的 segment 列表：

- `mm_struct` 中 `mmap` 双向列表，通过 `vm_next` 和 `vm_prev` 指针来维护双向列表。
- `mm_struct` 中 `mm_rb` 红黑列表 root 节点，和 `vm_area_struct` 中的 `mm_rb` 指针。

`segment` 也可能映射文件，所有会有一个 non-NULL 值在 `vm_file` 上，指向一个 `file`。
一个 `file` 会有 `address_space` 包含一个文件的所有 `pages` 在 `address_space` 对象上的 `page_tree` 属性上。
这个对象还通过线性和非线性列表来应用文件的 inode，因此这个文件的所有映射都可以共享。
另外一个映射方式 anonymous memory，这个数据保存在 `anon_vma` 结构中，
每一个 `segment` 都存在一个 `vm_mm` 指针引用 `mm_struct`。

mm_struct 还包含其他有用的信息，例如：

- 整个地址空间的 mmap_base
- stack 地址
- heap 地址
- text segments 地址

linux 可以保存缓存内存的统计信息，在进程的 `mm_struct` 中的 `rss_stat` 属性上。

## Page fault
如上所述，当一个进程访问内存时，memory management unit 获取一个地址，从 page table 找到这个地址的入口，并且获取到物理地址。
但是这个地址可能不存在。这时 CPU 将触发一个错误，这个错误叫做 page fault，
page faults 会发生在以下三种场景：

- Minor page fault：当 page table entry 存在，但是关联的 page 没有被分配，
  或者 page table entry 没有被创建。列如：linux 当第一次访问 page 时触发 minor page faults，而不是立即分配映射的 pages。
- Major page fault：Major page fault 是要求读取磁盘，但是要求读取 memory-mapped 文件或者进程的内存 paged-out 到了 swap 上。
- Invalid page fault：这个错误出现在应用程序要求读取非法地址，或者进去没有权限的 `segment` (如：写 `text segment`)。
  这样的情况会引发操作系统发送 `SIGSEGV` 信号，一个特殊的例子是，当 forked 的进程尝试写父进程的内存时，会引发一个 `copy-on-write fault`。
  这种情况下，操作系统会拷贝 page 并且设置新的 mapping 到 forked 的进程上。

Page faults 是影响性能的，因为这个会中断进程的执行，所有设计了各种系统调用，
mlock(), madvise() 这些允许为内存区域设置 flag 来减少 memory faults。
例如：mlock() 应该保证内存的分配，所以这个内存区域不会引发 minor fault。
如果 page faults 出现在 kernel 地址空间，这个将导致 kernel panic。

## Kernel allocator
`Virtual memory` 在 kernel 和 application 之间的分配子系统叫做 `kernel allocator`。
这个可能会被用到应用程序或者 kernel 内部，如： ethernet packets，block input-output buffers 等。

底层级的 kernel allocator 是一个 page allocator。这个维护了一个 free pages 列表，
cache pages 是 cache 文件系统数据，这个可能会很容易被驱逐。used pages 会被保留，因为这个需要被刷入磁盘中。

对于 kernel 对象而言，单页(4k 或者 8k)通常太大了，因为这些结构通常比较小。
另外，实现一个经典的堆内存分配其不是非常有效，kernel 需要经常分配相同大小的对象。

![](http://myaut.github.io/dtrace-stap-book/images/kmem.png)

## 参考

- [virtual memory](http://myaut.github.io/dtrace-stap-book/kernel/virtmem.html)

[-10]:    http://hushi55.github.io/  "-10"
