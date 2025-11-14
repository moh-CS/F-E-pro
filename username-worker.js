
self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'VALIDATE_USERNAME':
            const result = validateUsername(data.username);
            self.postMessage({ type: 'VALIDATION_RESULT', result });
            break;
            
        case 'GENERATE_ALTERNATIVES':
            const alternatives = generateSmartAlternatives(data.username, data.maxLength);
            self.postMessage({ type: 'ALTERNATIVES_GENERATED', alternatives });
            break;
    }
});

function validateUsername(username) {
    if (!username) return { valid: false, message: 'Username is required' };
    
    const USERNAME_MIN = 3;
    const USERNAME_MAX = 12;
    
    if (username.length < USERNAME_MIN) {
        return { valid: false, message: `Minimum ${USERNAME_MIN} characters required` };
    }
    
    if (username.length > USERNAME_MAX) {
        return { valid: false, message: `Maximum ${USERNAME_MAX} characters allowed` };
    }
    
    if (username.includes(' ')) {
        return { valid: false, message: 'Spaces are not allowed in username' };
    }
    
    if (!/^[a-zA-Z0-9_#$]+$/.test(username)) {
        return { valid: false, message: 'Only letters, numbers, _, #, and $ allowed' };
    }
    
    if (!/^[a-zA-Z0-9]/.test(username)) {
        return { valid: false, message: 'Must start with letter or number' };
    }
    
    if (/^\d+$/.test(username)) {
        return { valid: false, message: 'Username cannot be all numbers' };
    }
    
    const letterCount = (username.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 6) {
        return { valid: false, message: 'Must contain at least 6 letters' };
    }
    
    return { valid: true, message: 'Valid username format' };
}

// ========== SMART ALTERNATIVE GENERATION ==========
function generateSmartAlternatives(baseUsername, maxLength) {
    const suggestions = [];
    const lowerBase = baseUsername.toLowerCase();
    
    // Strategy 1: Abbreviations and shortened versions (for long usernames)
    if (baseUsername.length >= 8) {
        // Remove vowels except first letter
        const firstChar = baseUsername[0];
        const noVowels = firstChar + baseUsername.slice(1).replace(/[aeiouAEIOU]/g, '');
        if (noVowels.length >= 3 && noVowels.length <= maxLength && noVowels !== baseUsername) {
            suggestions.push(noVowels);
        }
        
        // Take first 3 and last 3 characters with separator
        if (baseUsername.length >= 6) {
            const abbrev1 = baseUsername.substring(0, 3) + '_' + baseUsername.substring(baseUsername.length - 3);
            if (abbrev1.length <= maxLength) {
                suggestions.push(abbrev1);
            }
        }
        
        // Use initials pattern with numbers
        const firstHalf = baseUsername.substring(0, Math.floor(baseUsername.length / 2));
        if (firstHalf.length >= 3 && firstHalf.length <= maxLength - 2) {
            suggestions.push(firstHalf + '##');
        }
    }
    
    // Strategy 2: Smart character substitution (leetspeak intelligent)
    if (suggestions.length < 5) {
        const substitutions = {
            'a': ['4', '@'],
            'e': ['3'],
            'i': ['1'],
            'o': ['0'],
            's': ['5', '$'],
            't': ['7'],
            'l': ['1']
        };
        
        let substituted = baseUsername;
        for (const [letter, replacements] of Object.entries(substitutions)) {
            const regex = new RegExp(letter, 'gi');
            const matches = baseUsername.match(regex);
            if (matches && matches.length > 0) {
                // Replace only one occurrence
                substituted = baseUsername.replace(regex, replacements[0]);
                if (substituted !== baseUsername && substituted.length <= maxLength) {
                    suggestions.push(substituted);
                    break;
                }
            }
        }
    }
    
    // Strategy 3: Prefix with common short words
    if (suggestions.length < 5) {
        const shortPrefixes = ['my', 'im', 'mr', 'dr', 'x'];
        for (const prefix of shortPrefixes) {
            const prefixed = prefix + baseUsername;
            if (prefixed.length <= maxLength) {
                suggestions.push(prefixed);
                if (suggestions.length >= 5) break;
            }
        }
    }
    
    // Strategy 4: Suffix with special characters and numbers
    if (suggestions.length < 5) {
        const suffixes = ['_x', '_v', '#1', '$1', '99', '21', '23'];
        for (const suffix of suffixes) {
            const suffixed = baseUsername.substring(0, maxLength - suffix.length) + suffix;
            if (suffixed.length <= maxLength && suffixed !== baseUsername) {
                suggestions.push(suffixed);
                if (suggestions.length >= 5) break;
            }
        }
    }
    
    // Strategy 5: Replace middle characters
    if (suggestions.length < 5 && baseUsername.length >= 5) {
        const start = baseUsername.substring(0, 2);
        const end = baseUsername.substring(baseUsername.length - 2);
        const midReplacements = ['xx', 'vv', '##', '$$', '00'];
        
        for (const mid of midReplacements) {
            const modified = start + mid + end;
            if (modified.length <= maxLength) {
                suggestions.push(modified);
                if (suggestions.length >= 5) break;
            }
        }
    }
    
    // Strategy 6: Reverse patterns
    if (suggestions.length < 5 && baseUsername.length <= maxLength / 2) {
        const reversed = baseUsername.split('').reverse().join('');
        suggestions.push(reversed);
    }
    
    // Strategy 7: CamelCase variations
    if (suggestions.length < 5 && baseUsername.length >= 4) {
        const camelCase = baseUsername.charAt(0).toUpperCase() + 
                         baseUsername.slice(1, -1).toLowerCase() + 
                         baseUsername.charAt(baseUsername.length - 1).toUpperCase();
        if (camelCase !== baseUsername) {
            suggestions.push(camelCase);
        }
    }
    
    // Strategy 8: Split and rejoin with separator
    if (suggestions.length < 5 && baseUsername.length >= 6) {
        const mid = Math.floor(baseUsername.length / 2);
        const split1 = baseUsername.substring(0, mid) + '_' + baseUsername.substring(mid);
        const split2 = baseUsername.substring(0, mid) + '$' + baseUsername.substring(mid);
        
        if (split1.length <= maxLength) suggestions.push(split1);
        if (split2.length <= maxLength) suggestions.push(split2);
    }
    
    // Strategy 9: Use year/random numbers
    if (suggestions.length < 5) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        const years = [currentYear, '00', '01', '02', '03'];
        
        for (const year of years) {
            const withYear = baseUsername.substring(0, maxLength - 2) + year;
            if (withYear.length <= maxLength && withYear !== baseUsername) {
                suggestions.push(withYear);
                if (suggestions.length >= 5) break;
            }
        }
    }
    
    // Strategy 10: First letter + numbers pattern
    if (suggestions.length < 5 && baseUsername.length >= 3) {
        const firstLetter = baseUsername[0];
        const numbers = ['123', '321', '777', '888', '999'];
        
        for (const num of numbers) {
            const pattern = firstLetter + num + baseUsername.substring(1, maxLength - num.length - 1);
            if (pattern.length >= 3 && pattern.length <= maxLength) {
                suggestions.push(pattern);
                if (suggestions.length >= 5) break;
            }
        }
    }
    
    // Remove duplicates and ensure all meet requirements
    const uniqueSuggestions = [...new Set(suggestions)];
    const validSuggestions = uniqueSuggestions.filter(s => {
        const validation = validateUsername(s);
        return validation.valid && s !== baseUsername;
    });
    
    return validSuggestions.slice(0, 6); // Return up to 6 smart suggestions
}