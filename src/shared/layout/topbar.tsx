import PersonIcon from "@mui/icons-material/Person";
import { useLocation, useNavigate } from "react-router-dom";
import logo from '../../assets/NNP_logo.png';
import { getXUser } from '../utils';
import ThemeToggle from '../../widgets/themetoggle';

interface TopBarProps {
    title?: string;
}

const TopBar = ({ title = "SCIO BAZO" }: TopBarProps) => {
    const username = getXUser();
    const location = useLocation(); 
    const navigate = useNavigate(); 

    // We still need this to know which button to show
    const isSqlPage = location.pathname.includes('/sql-query');

    return (
        <div className="bg-black text-white flex justify-between items-center px-4 py-2 h-16 w-full shrink-0 shadow-md z-10">
            <div className="flex items-center h-full gap-4">
                <div className="flex items-center">
                    <img src={logo} className="h-10 mr-4" alt="Logo" />
                    <span className="text-gray-200 tracking-wider text-base font-medium">
                        {/* Render the title prop directly here */}
                        {title}
                    </span>
                </div>
                
                <div className="text-gray-600 font-light text-xl">|</div>

                {/* --- RELOCATED SEAMLESS TEXT NAVIGATION BUTTON --- */}
                {isSqlPage ? (
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="text-gray-200 hover:text-[#5bc0de] tracking-wider text-base font-medium transition-colors uppercase cursor-pointer"
                    >
                        KNOWLEDGE BASE
                    </button>
                ) : (
                    <button 
                        onClick={() => navigate('/sql-query')}
                        className="text-gray-200 hover:text-[#5bc0de] tracking-wider text-base font-medium transition-colors uppercase cursor-pointer"
                    >
                        SQL QUERY
                    </button>
                )}
            </div>
            
            <div className="flex items-center text-sm gap-4">
                {/* --- THEME TOGGLE BUTTON INSTEAD OF NAV BUTTON --- */}
                <ThemeToggle />

                <div className="mx-2 text-gray-500">|</div>

                <div className="flex items-center cursor-pointer text-[#5bc0de] hover:text-white transition-colors">
                    <PersonIcon sx={{ fontSize: "1.25rem", marginRight: "4px" }} />
                    <span>{username}</span>
                </div>
            </div>
        </div>
    );
};

export default TopBar;