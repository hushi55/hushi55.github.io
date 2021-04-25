---
layout: post
title: nginx pool
description: nginx 内存池研究
category: code
tags: [nginx, c, linux]
---
nginx 内存布局结构图：

![](http://7tsy8h.com1.z0.glb.clouddn.com/ngx_pool.png)

来看看相关的数据结构：

```cgo
typedef struct {
    u_char               *last;
    u_char               *end;
    ngx_pool_t           *next;
    ngx_uint_t            failed;
} ngx_pool_data_t;


struct ngx_pool_s {
    ngx_pool_data_t       d;
    size_t                max;
    ngx_pool_t           *current;
    ngx_chain_t          *chain;
    ngx_pool_large_t     *large;
    ngx_pool_cleanup_t   *cleanup;
    ngx_log_t            *log;
};
```

我们先来看看 pool 的 create 结合上面的图来理解：

```cgo
ngx_pool_t *
ngx_create_pool(size_t size, ngx_log_t *log)
{
    ngx_pool_t  *p;

	/**
	 * 像系统申请 size 大小的内存，并且以 NGX_POOL_ALIGNMENT 对其方式
	 */
    p = ngx_memalign(NGX_POOL_ALIGNMENT, size, log);
    if (p == NULL) {
        return NULL;
    }

	/**
	 * 这里讲 last 指向这块内存前面分配给的 ngx_pool_t 存放元数据
	 * 后面的内存， end 指向这块内存的最后位置。
	 */
    p->d.last = (u_char *) p + sizeof(ngx_pool_t);
    p->d.end = (u_char *) p + size;
    p->d.next = NULL;
    p->d.failed = 0;

	/**
	 * 这里表明了像 pool 申请 NGX_MAX_ALLOC_FROM_POOL 将不能全部利用
	 */
    size = size - sizeof(ngx_pool_t);
    p->max = (size < NGX_MAX_ALLOC_FROM_POOL) ? size : NGX_MAX_ALLOC_FROM_POOL;

    p->current = p;
    p->chain = NULL;
    p->large = NULL;
    p->cleanup = NULL;
    p->log = log;

    return p;
}
```

看完了 create，我们来看看当想 pool 中申请内存的算法：

```cgo
void *
ngx_palloc(ngx_pool_t *pool, size_t size)
{
    u_char      *m;
    ngx_pool_t  *p;

	/**
	 * 申请的大小大于 max 时，使用 ngx_palloc_large 分配
	 */
    if (size <= pool->max) {

        p = pool->current;

        do {
        	// 从内存开始位置分配，以 NGX_ALIGNMENT 方式。
            m = ngx_align_ptr(p->d.last, NGX_ALIGNMENT);

			// 大小满足，分配
            if ((size_t) (p->d.end - m) >= size) {
                p->d.last = m + size;

                return m;
            }

            p = p->d.next;

        } while (p);

		// 若是整个链表都没有符合要求的内存块，想系统申请。 
		// 并且挂载到链表末尾
        return ngx_palloc_block(pool, size);
    }

    return ngx_palloc_large(pool, size);
}       
```

看完了小块内存的分配，我们来看看大块内存的分配：

```cgo
static void *
ngx_palloc_large(ngx_pool_t *pool, size_t size)
{
    void              *p;
    ngx_uint_t         n;
    ngx_pool_large_t  *large;

	// 首先向系统申请 size 大小的内存
    p = ngx_alloc(size, pool->log);
    if (p == NULL) {
        return NULL;
    }

    n = 0;

	// 像 large 链表中查找，最大查找  3 次
    for (large = pool->large; large; large = large->next) {
        if (large->alloc == NULL) {
            large->alloc = p;
            return p;
        }

        if (n++ > 3) {
            break;
        }
    }

	// 申请 large 元数据内存。
    large = ngx_palloc(pool, sizeof(ngx_pool_large_t));
    if (large == NULL) {
        ngx_free(p);
        return NULL;
    }

	// 挂载到 large 链表终点头部。
    large->alloc = p;
    large->next = pool->large;
    pool->large = large;

    return p;
}
```

## 参考
- http://my.oschina.net/victorlovecode/blog/344422
- http://blog.csdn.net/chen19870707/article/details/41015613
- http://www.cnblogs.com/didiaoxiong/p/nginx_memory.html


[-10]:    http://hushi55.github.io/  "-10"
