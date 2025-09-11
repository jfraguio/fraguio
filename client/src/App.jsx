import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PostDetail from './pages/PostDetail'
import AdminNew from './pages/AdminNew'
import AdminEdit from './pages/AdminEdit'

function App() {
  return (
    <div className="container">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/admin/new" element={<AdminNew />} />
        <Route path="/admin/edit/:id" element={<AdminEdit />} />
      </Routes>
    </div>
  )
}

export default App
