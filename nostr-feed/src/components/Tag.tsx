import { useNavigate } from 'react-router-dom';

interface TagProps {
  text: string;
  onClick?: () => void;
}

export function Tag({ text, onClick }: TagProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: navigate to tag page
      navigate(`/tag/${text}`);
    }
  };

  return (
    <span 
      className="tag" 
      onClick={handleClick}
    >
      #{text}
    </span>
  );
} 