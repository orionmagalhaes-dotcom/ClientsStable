
import React from 'react';
import { Dorama } from '../types';
import { PlayCircle, Heart, Plus, CheckCircle2, Trash2, Minus, PlusCircle, Film, Edit3, Star, Check, Tv2, Clapperboard } from 'lucide-react';

interface DoramaListProps {
  title: string;
  doramas: Dorama[];
  type: 'favorites' | 'watching' | 'completed';
  onAdd: () => void;
  onUpdate?: (dorama: Dorama) => void;
  onDelete?: (doramaId: string) => void;
  onEdit?: (dorama: Dorama) => void; 
}

const DoramaList: React.FC<DoramaListProps> = ({ title, doramas, type, onAdd, onUpdate, onDelete, onEdit }) => {
  const getIcon = () => {
    switch (type) {
      case 'favorites': return <Heart className="w-8 h-8 mr-3 text-primary-600 fill-current" />;
      case 'completed': return <CheckCircle2 className="w-8 h-8 mr-3 text-green-600" />;
      default: return <PlayCircle className="w-8 h-8 mr-3 text-primary-600" />;
    }
  };

  const getEmptyMessage = () => {
    switch (type) {
      case 'favorites': return 'Sua lista de favoritos está vazia.';
      case 'completed': return 'Você ainda não marcou nenhum dorama como concluído.';
      default: return 'Você não está assistindo nada no momento.';
    }
  };

  const handleIncrementEpisode = (e: React.MouseEvent, dorama: Dorama) => {
    e.stopPropagation();
    if (onUpdate) {
      const nextEp = (dorama.episodesWatched || 0) + 1;
      if (nextEp <= 99) {
          onUpdate({ ...dorama, episodesWatched: nextEp });
      }
    }
  };

  const handleDecrementEpisode = (e: React.MouseEvent, dorama: Dorama) => {
    e.stopPropagation();
    if (onUpdate && (dorama.episodesWatched || 0) > 1) {
      onUpdate({ ...dorama, episodesWatched: (dorama.episodesWatched || 0) - 1 });
    }
  };

  const handleIncrementSeason = (e: React.MouseEvent, dorama: Dorama) => {
    e.stopPropagation();
    if (onUpdate) {
        const nextSeason = (dorama.season || 1) + 1;
        if (nextSeason <= 99) {
            onUpdate({ ...dorama, season: nextSeason });
        }
    }
  };

  const handleDecrementSeason = (e: React.MouseEvent, dorama: Dorama) => {
    e.stopPropagation();
    if (onUpdate && (dorama.season || 1) > 1) {
        onUpdate({ ...dorama, season: (dorama.season || 1) - 1 });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    if (onDelete) {
        onDelete(id);
    }
  };

  const handleEditClick = (e: React.MouseEvent, dorama: Dorama) => {
      e.preventDefault();
      e.stopPropagation();
      if (onEdit) {
          onEdit(dorama);
      }
  };

  const renderStars = (count: number) => {
      return (
          <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                  <Heart 
                    key={star} 
                    className={`w-3 h-3 ${star <= count ? 'text-red-500 fill-red-500' : 'text-gray-300'}`} 
                  />
              ))}
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-28">
      <div className="flex justify-between items-center px-4 pt-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          {getIcon()}
          {title}
        </h2>
        <button 
          onClick={onAdd}
          className="bg-primary-600 text-white p-2.5 rounded-full hover:bg-primary-700 shadow-lg transition-colors flex items-center gap-2"
          title="Adicionar"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {doramas.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-2xl shadow-sm mx-4 border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-6">
            {getEmptyMessage()}
          </p>
          <button 
            onClick={onAdd}
            className="text-primary-700 font-bold text-xl hover:underline bg-primary-50 px-6 py-3 rounded-xl"
          >
            + Adicionar Novo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4">
          {doramas.map((dorama) => (
            <div key={dorama.id} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-200 relative">
              <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 w-full">
                      <div className={`p-3 rounded-xl flex-shrink-0 ${type === 'completed' ? 'bg-green-100 text-green-600' : 'bg-primary-100 text-primary-600'}`}>
                          {type === 'completed' ? <Check className="w-6 h-6" /> : <Film className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{dorama.title}</h3>
                          
                          {type !== 'watching' && (
                              <div className="flex items-center gap-2 mt-1">
                                 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${type === 'completed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                     {dorama.genre || 'Dorama'}
                                 </span>
                              </div>
                          )}
                          
                          {type === 'favorites' && dorama.rating && (
                              <div className="mt-2">
                                  {renderStars(dorama.rating)}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="flex gap-1 absolute top-3 right-3">
                    {onEdit && (
                        <button 
                            type="button"
                            onClick={(e) => handleEditClick(e, dorama)}
                            className="text-gray-400 hover:text-blue-500 p-2 transition-colors"
                        >
                            <Edit3 className="w-5 h-5" />
                        </button>
                    )}
                    {onDelete && (
                        <button 
                            type="button"
                            onClick={(e) => handleDeleteClick(e, dorama.id)}
                            className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                  </div>
              </div>

              {type === 'watching' && onUpdate && (
                <div className="mt-4 flex flex-col gap-3">
                    {/* Season Controls */}
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <span className="text-xs font-bold text-gray-500 uppercase ml-2 flex items-center gap-1">
                            <Tv2 className="w-3 h-3" /> Temporada
                        </span>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={(e) => handleDecrementSeason(e, dorama)} 
                                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-lg font-black text-gray-800 w-6 text-center">{dorama.season || 1}</span>
                            <button 
                                onClick={(e) => handleIncrementSeason(e, dorama)} 
                                className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Episode Controls */}
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <span className="text-xs font-bold text-gray-500 uppercase ml-2 flex items-center gap-1">
                            <Clapperboard className="w-3 h-3" /> Episódio
                        </span>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={(e) => handleDecrementEpisode(e, dorama)} 
                                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-lg font-black text-gray-800 w-6 text-center">{dorama.episodesWatched || 1}</span>
                            <button 
                                onClick={(e) => handleIncrementEpisode(e, dorama)} 
                                className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-lg shadow-sm hover:bg-primary-700 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoramaList;
