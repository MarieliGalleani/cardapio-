import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './lib/api'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('./loja/LojaLayout.vue'),
      children: [
        { path: '', component: () => import('./loja/LojaHome.vue') },
        { path: 'sacola', component: () => import('./loja/SacolaView.vue') },
        { path: 'checkout', component: () => import('./loja/CheckoutView.vue') },
        { path: 'pedido/:token', component: () => import('./loja/PedidoView.vue') },
      ],
    },
    { path: '/admin/login', component: () => import('./admin/views/LoginView.vue'), meta: { public: true } },
    {
      path: '/admin',
      component: () => import('./admin/AdminLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('./admin/views/DashboardView.vue') },
        { path: 'pedidos', name: 'pedidos', component: () => import('./admin/views/PedidosView.vue') },
        { path: 'cardapio', name: 'cardapio', component: () => import('./admin/views/CardapioView.vue') },
        { path: 'estoque', name: 'estoque', component: () => import('./admin/views/EstoqueView.vue') },
        { path: 'fichas', name: 'fichas', component: () => import('./admin/views/FichaTecnicaView.vue') },
        { path: 'configuracoes', name: 'configuracoes', component: () => import('./admin/views/ConfiguracoesView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  if (to.path.startsWith('/admin') && !to.meta.public && !auth.token) return '/admin/login'
})
