---
layout: post
title: nginx的slab
description: nginx的slab的内存管理方式源码分析
category: code
tags: [nginx, c, slab, linux]
---
## 内存布局图
先来看看 slab 管理的内存布局图：

![](http://img.blog.csdn.net/20130914221301406?watermark/2/text/aHR0cDovL2Jsb2cuY3Nkbi5uZXQvUm95YWxBcGV4/font/5a6L5L2T/fontsize/400/fill/I0JBQkFCMA==/dissolve/70/gravity/SouthEast)

<pre>
typedef struct {
    ngx_shmtx_sh_t    lock;

    size_t            min_size;
    size_t            min_shift;

    ngx_slab_page_t  *pages;
    ngx_slab_page_t  *last;
    ngx_slab_page_t   free;

    u_char           *start;
    u_char           *end;

    ngx_shmtx_t       mutex;

    u_char           *log_ctx;
    u_char            zero;

    unsigned          log_nomem:1;

    void             *data;
    void             *addr;
} ngx_slab_pool_t;
</pre>

![](http://images.cnitblog.com/blog/573246/201311/07152129-8c007d2689ab4f50aa35486df7993c11.jpg)

解释：
将一整块内存管理起来，分为小内存管理和大内存管理，其中 slot 数组管理小内存， page 管理大内存。slot 管理小于 pagesize/2 大小的分配，大于 pagesize/2 的都是整个 page 的分配。slot 数组管理一定大小的内存，将一个 page 分为大小一样的 slot 来管理。搞清楚这个算法，看看它的初始化，就能明白：

<pre>
void
ngx_slab_init(ngx_slab_pool_t *pool)
{
    u_char           *p;
    size_t            size;
    ngx_int_t         m;
    ngx_uint_t        i, n, pages;
    ngx_slab_page_t  *slots;

    /* STUB */
    if (ngx_slab_max_size == 0) {
        ngx_slab_max_size = ngx_pagesize / 2;
        ngx_slab_exact_size = ngx_pagesize / (8 * sizeof(uintptr_t));
        for (n = ngx_slab_exact_size; n >>= 1; ngx_slab_exact_shift++) {
            /* void */
        }
    }
    /**/

    pool->min_size = 1 << pool->min_shift;

    p = (u_char *) pool + sizeof(ngx_slab_pool_t);
    size = pool->end - p;

    ngx_slab_junk(p, size);

    slots = (ngx_slab_page_t *) p;
    n = ngx_pagesize_shift - pool->min_shift;
    
    
    for (i = 0; i < n; i++) {
        slots[i].slab = 0;
        slots[i].next = &slots[i];
        slots[i].prev = 0;
    }

    p += n * sizeof(ngx_slab_page_t);

    pages = (ngx_uint_t) (size / (ngx_pagesize + sizeof(ngx_slab_page_t)));

    ngx_memzero(p, pages * sizeof(ngx_slab_page_t));

    pool->pages = (ngx_slab_page_t *) p;

    pool->free.prev = 0;
    pool->free.next = (ngx_slab_page_t *) p;

    pool->pages->slab = pages;
    pool->pages->next = &pool->free;
    pool->pages->prev = (uintptr_t) &pool->free;

    pool->start = (u_char *)
                  ngx_align_ptr((uintptr_t) p + pages * sizeof(ngx_slab_page_t),
                                 ngx_pagesize);

    m = pages - (pool->end - pool->start) / ngx_pagesize;
    if (m > 0) {
        pages -= m;
        pool->pages->slab = pages;  
    }

    pool->last = pool->pages + pages;

    pool->log_nomem = 1;
    pool->log_ctx = &pool->zero;
    pool->zero = '\0';
}
</pre>

## 参考
- [http://www.cnblogs.com/doop-ymc/p/3412572.html](http://www.cnblogs.com/doop-ymc/p/3412572.html)
- [http://blog.csdn.net/qifengzou/article/details/11678115](http://blog.csdn.net/qifengzou/article/details/11678115)
- []()

[-10]:    http://hushi55.github.io/  "-10"
