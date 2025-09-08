import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function AdminNew() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('El título y el contenido son obligatorios')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear la entrada')
      }

      // Éxito: redirigir al inicio
      navigate('/')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <>
      <Link to="/" className="nav-link">← Volver al inicio</Link>
      
      <header className="header">
        <h1 className="site-title">Nueva Entrada</h1>
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
            disabled={loading}
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
            disabled={loading}
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
              disabled={loading}
            />
            <label htmlFor="is_pinned" className="form-label">
              Fijar en portada
            </label>
          </div>
        </div>

        <button 
          type="submit" 
          className="form-submit"
          disabled={loading}
        >
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
      </form>
    </>
  )
}

export default AdminNew
