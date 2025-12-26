import React from 'react';

interface MenuCardProps {
  name: string;
  price: string;
  category: string;
}

export const MenuCard: React.FC<MenuCardProps> = ({ name, price, category }) => {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-amber-500 transition-colors duration-300 group">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white group-hover:text-amber-500 transition-colors">{name}</h3>
        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded uppercase">{category}</span>
      </div>
      <p className="text-stone-400 font-mono text-sm">{price}</p>
    </div>
  );
};