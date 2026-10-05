import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { crearQueryClient } from './api/queryClient';
import { rutas } from './rutas';
import { SesionProvider } from './sesion/SesionProvider';
import './index.css';

const queryClient = crearQueryClient();
const router = createBrowserRouter(rutas);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SesionProvider>
        <RouterProvider router={router} />
      </SesionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
