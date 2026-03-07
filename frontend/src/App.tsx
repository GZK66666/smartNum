import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import DataSourcePage from '@/pages/DataSourcePage';
import NewDataSourcePage from '@/pages/NewDataSourcePage';
import ChatPage from '@/pages/ChatPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DataSourcePage />} />
        <Route path="/datasource/new" element={<NewDataSourcePage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </Layout>
  );
}