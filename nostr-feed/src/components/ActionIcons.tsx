import { 
  FiRepeat, 
  FiMessageSquare, 
  FiHeart, 
  FiZap, 
  FiShare2, 
  FiLink 
} from 'react-icons/fi';

interface IconProps {
  size?: number;
  className?: string;
}

export const RepostIcon = ({ size = 18, className = '' }: IconProps) => {
  return <FiRepeat size={size} className={className} />;
};

export const ReplyIcon = ({ size = 18, className = '' }: IconProps) => {
  return <FiMessageSquare size={size} className={className} />;
};

export const LikeIcon = ({ size = 18, className = '' }: IconProps) => {
  return <FiHeart size={size} className={className} />;
};

export const ZapIcon = ({ size = 18, className = '' }: IconProps) => {
  return <FiZap size={size} className={className} />;
};

export const ShareIcon = ({ size = 18, className = '' }: IconProps) => {
  return <FiShare2 size={size} className={className} />;
};

export const LinkIcon = ({ size = 18, className = '' }: IconProps) => {
  return <FiLink size={size} className={className} />;
};

// For filled heart when liked
export const FilledHeartIcon = ({ size = 18, className = '' }: IconProps) => {
  return (
    <FiHeart 
      size={size} 
      className={`${className} filled`} 
      fill="currentColor"
    />
  );
}; 