import { Link } from 'react-router';
import { Button } from '@/componentes/ui/button';

export function NoEncontrada() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold">No encontramos esta página</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
