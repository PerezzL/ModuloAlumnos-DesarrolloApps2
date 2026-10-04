import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Calendario, CategoriaCalendario } from '@uadenet/api-types';
import { api } from '@/api/cliente';
import { datosDe } from '@/api/errores';

type Rango = { desde: string; hasta: string };

const pedir = (rango: Rango, categorias?: CategoriaCalendario[]) =>
  datosDe(
    api.GET('/calendario', {
      params: { query: { ...rango, ...(categorias && { categorias }) } },
    }),
  );

/**
 * Junta el resultado de reintentar algunas categorías con lo que ya había: reemplaza los
 * ítems y el estado de esas categorías y deja el resto como estaba.
 */
export function combinar(actual: Calendario, parcial: Calendario): Calendario {
  const reintentadas = new Set(parcial.fuentes.map((f) => f.categoria));
  return {
    items: [...actual.items.filter((i) => !reintentadas.has(i.categoria)), ...parcial.items].sort(
      (a, b) => Date.parse(a.inicio) - Date.parse(b.inicio),
    ),
    fuentes: actual.fuentes.map(
      (f) => parcial.fuentes.find((p) => p.categoria === f.categoria) ?? f,
    ),
  };
}

/**
 * `GET /calendario` del rango visible. Sin categorías elegidas no se pide nada.
 * `reintentar` vuelve a pedir solo las categorías que fallaron y las suma a lo que ya cargó.
 */
export function useCalendario(rango: Rango, categorias?: CategoriaCalendario[]) {
  const queryClient = useQueryClient();
  const todas = !categorias || categorias.length === 3;
  const queryKey = [
    'calendario',
    rango.desde,
    rango.hasta,
    todas ? 'todas' : [...categorias].sort().join(),
  ];

  const consulta = useQuery({
    queryKey,
    queryFn: (): Promise<Calendario> => pedir(rango, todas ? undefined : categorias),
    enabled: categorias === undefined || categorias.length > 0,
  });

  const reintento = useMutation({
    mutationFn: (fallidas: CategoriaCalendario[]) => pedir(rango, fallidas),
    onSuccess: (parcial) =>
      queryClient.setQueryData<Calendario>(queryKey, (actual) =>
        actual ? combinar(actual, parcial) : parcial,
      ),
  });

  // El resultado de un reintento es del período en que se hizo
  const { reset } = reintento;
  const clave = queryKey.join('|');
  useEffect(() => reset(), [clave, reset]);

  return { ...consulta, reintento };
}
