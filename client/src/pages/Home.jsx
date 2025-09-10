import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

function Home() {
  const [pinnedPosts, setPinnedPosts] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const observerRef = useRef()

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-ES', { 
      month: 'long', 
      year: 'numeric' 
    }).format(date)
  }

  const formatContent = (content) => {
    return content.split('\n').map((paragraph, index) => {
      if (paragraph.trim() === '') return null
      return <p key={index}>{paragraph}</p>
    }).filter(Boolean)
  }

  // Cargar entradas fijadas
  useEffect(() => {
    fetch('/api/pinned')
      .then(res => res.json())
      .then(data => setPinnedPosts(data))
      .catch(err => console.error('Error loading pinned posts:', err))
  }, [])

  // Cargar entradas del feed
  const loadPosts = useCallback(async (reset = false) => {
    if (loading) return
    
    setLoading(true)
    const currentOffset = reset ? 0 : offset
    
    try {
      const response = await fetch(`/api/posts?offset=${currentOffset}&limit=50`)
      const data = await response.json()
      
      if (reset) {
        setPosts(data)
        setOffset(50)
      } else {
        setPosts(prev => [...prev, ...data])
        setOffset(prev => prev + 50)
      }
      
      setHasMore(data.length === 50)
    } catch (err) {
      console.error('Error loading posts:', err)
    }
    
    setLoading(false)
  }, [loading, offset])

  // Cargar posts iniciales
  useEffect(() => {
    loadPosts(true)
  }, [])

  // Configurar observer para scroll infinito
  const sentinelRef = useCallback(node => {
    if (loading) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadPosts()
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [loading, hasMore, loadPosts])

  return (
    <>
      <header className="header">
        <h1 className="site-title">Fraguío</h1>
        
        {pinnedPosts.length > 0 && (
          <nav className="pinned-posts">
            {pinnedPosts.map(post => (
              <Link 
                key={post.id} 
                to={`/post/${post.id}`} 
                className="pinned-chip"
              >
                {post.title}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="posts-feed">
        {posts.map(post => (
          <article key={post.id} className="post-item">
            <Link to={`/post/${post.id}`} className="post-title">
              <label>{post.title}</label>
            </Link>
            <div className="post-content">
              {formatContent(post.content)}
            </div>
            <time className="post-date">
              {formatDate(post.created_at)}
            </time>
          </article>
        ))}
        
        {hasMore && (
          <div ref={sentinelRef} className="scroll-sentinel" />
        )}
        
        {loading && (
          <div className="loading">...</div>
        )}
      </main>
    </>
  )
}

export default Home
