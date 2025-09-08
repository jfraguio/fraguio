import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

function PostDetail() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Post not found')
        }
        return res.json()
      })
      .then(data => {
        setPost(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="loading">Cargando entrada...</div>
  }

  if (error) {
    return (
      <div>
        <Link to="/" className="nav-link">← Volver al inicio</Link>
        <div className="error-message">
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <>
      <Link to="/" className="nav-link">← Volver al inicio</Link>
      
      <article className="post-detail">
        <h1 className="post-title">{post.title}</h1>
        <time className="post-date">
          {formatDate(post.created_at)}
        </time>
        <div className="post-content">
          {formatContent(post.content)}
        </div>
      </article>
    </>
  )
}

export default PostDetail
