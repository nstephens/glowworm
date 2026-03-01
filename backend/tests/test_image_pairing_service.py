"""
Unit tests for Image Pairing Service

Tests image classification and pairing algorithms for both portrait and landscape displays.
"""

import pytest
from services.image_pairing_service import ImageClassificationService


class TestImageClassification:
    """Test image classification by aspect ratio"""
    
    def test_landscape_wide_image(self):
        """Images with aspect ratio > 1.1 should be classified as landscape"""
        assert ImageClassificationService.classify_image(1920, 1080) == 'landscape'
        assert ImageClassificationService.classify_image(3840, 2160) == 'landscape'
        assert ImageClassificationService.classify_image(1600, 900) == 'landscape'
    
    def test_portrait_tall_image(self):
        """Images with aspect ratio < 0.9 should be classified as portrait"""
        assert ImageClassificationService.classify_image(1080, 1920) == 'portrait'
        assert ImageClassificationService.classify_image(2160, 3840) == 'portrait'
        assert ImageClassificationService.classify_image(900, 1600) == 'portrait'
    
    def test_square_image_treated_as_portrait(self):
        """Square images (aspect ratio 0.9-1.1) should be treated as portrait"""
        assert ImageClassificationService.classify_image(1000, 1000) == 'portrait'
        assert ImageClassificationService.classify_image(1080, 1000) == 'portrait'
        assert ImageClassificationService.classify_image(1000, 1080) == 'portrait'
    
    def test_invalid_dimensions_default_to_portrait(self):
        """Invalid dimensions should default to portrait"""
        assert ImageClassificationService.classify_image(0, 1080) == 'portrait'
        assert ImageClassificationService.classify_image(1920, 0) == 'portrait'
        assert ImageClassificationService.classify_image(-100, 200) == 'portrait'


class TestPortraitDisplayPairing:
    """Test pairing algorithm for portrait displays"""
    
    def test_pairs_landscapes_singles_portraits(self):
        """Portrait display should pair landscapes, single portraits"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},  # portrait
            {'id': 2, 'width': 1920, 'height': 1080},  # landscape
            {'id': 3, 'width': 1920, 'height': 1080},  # landscape
            {'id': 4, 'width': 1080, 'height': 1920}   # portrait
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'single', 'images': [1]}
        assert result[1] == {'type': 'pair', 'images': [2, 3]}
        assert result[2] == {'type': 'single', 'images': [4]}
    
    def test_odd_number_of_landscapes(self):
        """Last landscape should display alone if odd number"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},
            {'id': 2, 'width': 1920, 'height': 1080},
            {'id': 3, 'width': 1920, 'height': 1080}
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 2
        assert result[0] == {'type': 'pair', 'images': [1, 2]}
        assert result[1] == {'type': 'single', 'images': [3]}
    
    def test_all_portraits_display_single(self):
        """All portrait images should display as singles"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},
            {'id': 2, 'width': 1080, 'height': 1920},
            {'id': 3, 'width': 1080, 'height': 1920}
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 3
        assert all(entry['type'] == 'single' for entry in result)
        assert result[0] == {'type': 'single', 'images': [1]}
        assert result[1] == {'type': 'single', 'images': [2]}
        assert result[2] == {'type': 'single', 'images': [3]}
    
    def test_mixed_sequence_with_square_images(self):
        """Square images treated as portrait (single)"""
        images = [
            {'id': 1, 'width': 1000, 'height': 1000},  # square -> portrait
            {'id': 2, 'width': 1920, 'height': 1080},  # landscape
            {'id': 3, 'width': 1920, 'height': 1080},  # landscape
            {'id': 4, 'width': 1000, 'height': 1000}   # square -> portrait
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'single', 'images': [1]}  # square
        assert result[1] == {'type': 'pair', 'images': [2, 3]}  # landscapes paired
        assert result[2] == {'type': 'single', 'images': [4]}  # square
    
    def test_landscape_between_portraits_breaks_pair(self):
        """Single landscape between portraits should display alone"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},  # portrait
            {'id': 2, 'width': 1920, 'height': 1080},  # landscape (alone)
            {'id': 3, 'width': 1080, 'height': 1920}   # portrait
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'single', 'images': [1]}
        assert result[1] == {'type': 'single', 'images': [2]}  # Alone
        assert result[2] == {'type': 'single', 'images': [3]}
    
    def test_empty_list_returns_empty_result(self):
        """Empty image list should return empty result"""
        result = ImageClassificationService.compute_portrait_sequence([])
        assert result == []
    
    def test_single_image_returns_single_entry(self):
        """Single image should return single entry regardless of orientation"""
        landscape = [{'id': 1, 'width': 1920, 'height': 1080}]
        portrait = [{'id': 2, 'width': 1080, 'height': 1920}]
        
        result_l = ImageClassificationService.compute_portrait_sequence(landscape)
        result_p = ImageClassificationService.compute_portrait_sequence(portrait)
        
        assert result_l == [{'type': 'single', 'images': [1]}]
        assert result_p == [{'type': 'single', 'images': [2]}]


class TestLandscapeDisplayPairing:
    """Test pairing algorithm for landscape displays"""
    
    def test_pairs_portraits_singles_landscapes(self):
        """Landscape display should pair portraits, single landscapes"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},  # landscape
            {'id': 2, 'width': 1080, 'height': 1920},  # portrait
            {'id': 3, 'width': 1080, 'height': 1920},  # portrait
            {'id': 4, 'width': 1920, 'height': 1080}   # landscape
        ]
        
        result = ImageClassificationService.compute_landscape_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'single', 'images': [1]}
        assert result[1] == {'type': 'pair', 'images': [2, 3]}
        assert result[2] == {'type': 'single', 'images': [4]}
    
    def test_odd_number_of_portraits(self):
        """Last portrait should display alone if odd number"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},
            {'id': 2, 'width': 1080, 'height': 1920},
            {'id': 3, 'width': 1080, 'height': 1920}
        ]
        
        result = ImageClassificationService.compute_landscape_sequence(images)
        
        assert len(result) == 2
        assert result[0] == {'type': 'pair', 'images': [1, 2]}
        assert result[1] == {'type': 'single', 'images': [3]}
    
    def test_all_landscapes_display_single(self):
        """All landscape images should display as singles"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},
            {'id': 2, 'width': 1920, 'height': 1080},
            {'id': 3, 'width': 1920, 'height': 1080}
        ]
        
        result = ImageClassificationService.compute_landscape_sequence(images)
        
        assert len(result) == 3
        assert all(entry['type'] == 'single' for entry in result)
    
    def test_portrait_between_landscapes_breaks_pair(self):
        """Single portrait between landscapes should display alone"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},  # landscape
            {'id': 2, 'width': 1080, 'height': 1920},  # portrait (alone)
            {'id': 3, 'width': 1920, 'height': 1080}   # landscape
        ]
        
        result = ImageClassificationService.compute_landscape_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'single', 'images': [1]}
        assert result[1] == {'type': 'single', 'images': [2]}  # Alone
        assert result[2] == {'type': 'single', 'images': [3]}


class TestComputeSequence:
    """Test the main compute_sequence dispatcher"""
    
    def test_portrait_orientation_uses_portrait_algorithm(self):
        """Portrait orientation should use portrait pairing logic"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},  # landscape
            {'id': 2, 'width': 1920, 'height': 1080}   # landscape
        ]
        
        result = ImageClassificationService.compute_sequence(images, 'portrait')
        
        assert len(result) == 1
        assert result[0] == {'type': 'pair', 'images': [1, 2]}  # Landscapes paired
    
    def test_landscape_orientation_uses_landscape_algorithm(self):
        """Landscape orientation should use landscape pairing logic"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},  # portrait
            {'id': 2, 'width': 1080, 'height': 1920}   # portrait
        ]
        
        result = ImageClassificationService.compute_sequence(images, 'landscape')
        
        assert len(result) == 1
        assert result[0] == {'type': 'pair', 'images': [1, 2]}  # Portraits paired
    
    def test_empty_list_returns_empty_for_both_orientations(self):
        """Empty list should return empty result for any orientation"""
        assert ImageClassificationService.compute_sequence([], 'portrait') == []
        assert ImageClassificationService.compute_sequence([], 'landscape') == []


class TestValidateSequenceConsistency:
    """Test sequence validation against optimal pairing"""
    
    def test_optimal_sequence_validates_successfully(self):
        """Sequence matching optimal pairing should validate"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},  # portrait
            {'id': 2, 'width': 1920, 'height': 1080},  # landscape
            {'id': 3, 'width': 1920, 'height': 1080}   # landscape
        ]
        sequence = [1, 2, 3]  # Optimal: single, pair
        
        result = ImageClassificationService.validate_sequence_consistency(
            sequence, images, 'portrait'
        )
        
        assert result['is_valid'] is True
        assert len(result['errors']) == 0
        assert result['optimal_sequence'] == [1, 2, 3]
    
    def test_suboptimal_sequence_returns_errors(self):
        """Sequence with interleaved images prevents optimal pairing"""
        # Portrait display with 6 landscapes interleaved with 3 portraits
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},  # landscape
            {'id': 2, 'width': 1080, 'height': 1920},  # portrait
            {'id': 3, 'width': 1920, 'height': 1080},  # landscape
            {'id': 4, 'width': 1080, 'height': 1920},  # portrait
            {'id': 5, 'width': 1920, 'height': 1080},  # landscape
            {'id': 6, 'width': 1080, 'height': 1920},  # portrait
            {'id': 7, 'width': 1920, 'height': 1080},  # landscape
            {'id': 8, 'width': 1920, 'height': 1080}   # landscape
        ]
        sequence = [1, 2, 3, 4, 5, 6, 7, 8]  # Interleaved - prevents pairing
        
        result = ImageClassificationService.validate_sequence_consistency(
            sequence, images, 'portrait'
        )
        
        # User sequence [L P L P L P L L]: only last 2 landscapes can pair = 1 pair
        # Optimal [P P P L L L L L]: 5 landscapes can form 2 pairs (with 1 single)
        assert result['is_valid'] is False
        assert len(result['errors']) > 0
        assert result['errors'][0]['type'] == 'suboptimal_pairing'
        # Optimal should have 2 pairs (5 landscapes / 2 = 2 pairs + 1 single)
        assert '2 pairs' in result['errors'][0]['message']
    
    def test_validation_provides_optimal_computed_structure(self):
        """Validation should return the optimal computed structure"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},
            {'id': 2, 'width': 1920, 'height': 1080},
            {'id': 3, 'width': 1920, 'height': 1080}
        ]
        sequence = [1, 2, 3]
        
        result = ImageClassificationService.validate_sequence_consistency(
            sequence, images, 'portrait'
        )
        
        assert 'optimal_computed' in result
        assert len(result['optimal_computed']) == 2
        assert result['optimal_computed'][0]['type'] == 'single'
        assert result['optimal_computed'][1]['type'] == 'pair'


class TestLargeImageSets:
    """Test performance with large image sets"""
    
    def test_handles_100_images_efficiently(self):
        """Should handle 100 images without issues"""
        # Create alternating landscape/portrait images
        images = []
        for i in range(100):
            if i % 2 == 0:
                images.append({'id': i, 'width': 1920, 'height': 1080})  # landscape
            else:
                images.append({'id': i, 'width': 1080, 'height': 1920})  # portrait
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        # Should have 50 pairs (all landscapes) + 50 singles (all portraits)
        # But they alternate, so each landscape will be single
        assert len(result) == 100  # All singles due to alternation
    
    def test_handles_1000_images_efficiently(self):
        """Should handle 1000 images without issues"""
        # All landscape images
        images = [{'id': i, 'width': 1920, 'height': 1080} for i in range(1000)]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        # Should have 500 pairs (1000 landscapes / 2)
        assert len(result) == 500
        assert all(entry['type'] == 'pair' for entry in result)
    
    def test_all_same_orientation_portrait_display(self):
        """100 landscape images on portrait display should pair optimally"""
        images = [{'id': i, 'width': 1920, 'height': 1080} for i in range(100)]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        # 100 landscapes / 2 = 50 pairs
        assert len(result) == 50
        assert all(entry['type'] == 'pair' for entry in result)
        assert all(len(entry['images']) == 2 for entry in result)


class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_single_landscape_on_portrait_display(self):
        """Single landscape on portrait display shows as single"""
        images = [{'id': 1, 'width': 1920, 'height': 1080}]
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert result == [{'type': 'single', 'images': [1]}]
    
    def test_three_landscapes_then_portrait(self):
        """3 landscapes followed by portrait: pair + single landscape + single portrait"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},  # landscape
            {'id': 2, 'width': 1920, 'height': 1080},  # landscape
            {'id': 3, 'width': 1920, 'height': 1080},  # landscape (odd one out)
            {'id': 4, 'width': 1080, 'height': 1920}   # portrait
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'pair', 'images': [1, 2]}
        assert result[1] == {'type': 'single', 'images': [3]}  # Odd landscape
        assert result[2] == {'type': 'single', 'images': [4]}  # Portrait
    
    def test_portrait_flush_before_new_portrait(self):
        """Buffered landscape should flush before processing portrait"""
        images = [
            {'id': 1, 'width': 1920, 'height': 1080},  # landscape (will be buffered)
            {'id': 2, 'width': 1080, 'height': 1920}   # portrait (triggers flush)
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        assert len(result) == 2
        assert result[0] == {'type': 'single', 'images': [1]}  # Flushed
        assert result[1] == {'type': 'single', 'images': [2]}  # Portrait
    
    def test_complex_mixed_sequence(self):
        """Complex realistic sequence"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},  # portrait
            {'id': 2, 'width': 1920, 'height': 1080},  # landscape
            {'id': 3, 'width': 1920, 'height': 1080},  # landscape
            {'id': 4, 'width': 1080, 'height': 1920},  # portrait
            {'id': 5, 'width': 1920, 'height': 1080},  # landscape
            {'id': 6, 'width': 1000, 'height': 1000},  # square -> portrait
            {'id': 7, 'width': 1920, 'height': 1080},  # landscape
            {'id': 8, 'width': 1920, 'height': 1080}   # landscape
        ]
        
        result = ImageClassificationService.compute_portrait_sequence(images)
        
        expected = [
            {'type': 'single', 'images': [1]},   # portrait
            {'type': 'pair', 'images': [2, 3]},   # landscape pair
            {'type': 'single', 'images': [4]},   # portrait
            {'type': 'single', 'images': [5]},   # landscape (flushed before square)
            {'type': 'single', 'images': [6]},   # square (portrait)
            {'type': 'pair', 'images': [7, 8]}    # landscape pair
        ]
        
        assert result == expected


class TestLandscapeEdgeCases:
    """Test edge cases for landscape display"""
    
    def test_three_portraits_then_landscape(self):
        """3 portraits followed by landscape: pair + single portrait + single landscape"""
        images = [
            {'id': 1, 'width': 1080, 'height': 1920},  # portrait
            {'id': 2, 'width': 1080, 'height': 1920},  # portrait
            {'id': 3, 'width': 1080, 'height': 1920},  # portrait (odd one out)
            {'id': 4, 'width': 1920, 'height': 1080}   # landscape
        ]
        
        result = ImageClassificationService.compute_landscape_sequence(images)
        
        assert len(result) == 3
        assert result[0] == {'type': 'pair', 'images': [1, 2]}
        assert result[1] == {'type': 'single', 'images': [3]}  # Odd portrait
        assert result[2] == {'type': 'single', 'images': [4]}  # Landscape


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

