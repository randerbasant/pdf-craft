import React from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Viewer } from './components/Viewer';
import { TextPropertiesPanel } from './components/TextPropertiesPanel';

const App: React.FC = () => {
  return (
    <div className="app-container">
      <Header />
      <div className="workspace-layout">
        <Sidebar />
        <Viewer />
        <TextPropertiesPanel />
      </div>
    </div>
  );
};

export default App;
