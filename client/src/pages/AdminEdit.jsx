import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

function AdminEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false
  })
  const [loading, setLoading] = useState(false)
  const [loadingPost, setLoadingPost] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Cargar los datos del post
  useEffect(() => {
    const loadPost = async () => {
      try {
        const response = await fetch(`/api/posts/${id}`)
        if (!response.ok) {
          throw new Error('Post no encontrado')
        }
        const post = await response.json()
        setFormData({
          title: post.title,
          content: post.content,
          is_pinned: post.is_pinned === 1
        })
        setLoadingPost(false)
      } catch (err) {
        setError(err.message)
        setLoadingPost(false)
      }
    }

    if (id) {
      loadPost()
    }
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('El título y el contenido son obligatorios')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (response.status === 401) {
        setError('Autenticación requerida. Verifica tus credenciales.')
        setLoading(false)
        return
      }

      if (!response.ok) {
        let errorMessage = 'Error al actualizar la entrada'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          // Si no puede parsear JSON, probablemente el servidor devolvió HTML de error
          if (response.status === 413) {
            errorMessage = 'El contenido es demasiado largo. Intenta reducir el tamaño.'
          } else if (response.status >= 500) {
            errorMessage = 'Error interno del servidor. Intenta de nuevo más tarde.'
          } else {
            errorMessage = `Error del servidor (${response.status})`
          }
        }
        throw new Error(errorMessage)
      }

      // Éxito: redirigir al post actualizado
      navigate(`/post/${id}`)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta entrada? Esta acción no se puede deshacer.')) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'DELETE'
      })

      if (response.status === 401) {
        setError('Autenticación requerida. Verifica tus credenciales.')
        setDeleting(false)
        return
      }

      if (!response.ok) {
        let errorMessage = 'Error al eliminar la entrada'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          // Si no puede parsear JSON, probablemente el servidor devolvió HTML de error
          if (response.status >= 500) {
            errorMessage = 'Error interno del servidor. Intenta de nuevo más tarde.'
          } else {
            errorMessage = `Error del servidor (${response.status})`
          }
        }
        throw new Error(errorMessage)
      }

      // Éxito: redirigir al inicio
      navigate('/')
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  if (loadingPost) {
    return (
      <div>
        <Link to="/" className="nav-link">←</Link>
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  return (
    <>
      <Link to="/" className="nav-link">←</Link>
      
      <header className="header">
        <h1 className="site-title">Editar Entrada</h1>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Título
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="form-input"
            required
            disabled={loading || deleting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content" className="form-label">
            Contenido
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            className="form-input form-textarea"
            required
            disabled={loading || deleting}
          />
        </div>

        <div className="form-group">
          <div className="form-checkbox-group">
            <input
              type="checkbox"
              id="is_pinned"
              name="is_pinned"
              checked={formData.is_pinned}
              onChange={handleChange}
              className="form-checkbox"
              disabled={loading || deleting}
            />
            <label htmlFor="is_pinned" className="form-label">
              Fijar en portada
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="form-submit"
            disabled={loading || deleting}
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
          
          <button 
            type="button" 
            className="form-delete"
            onClick={handleDelete}
            disabled={loading || deleting}
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </form>
    </>
  )
}

export default AdminEdit
